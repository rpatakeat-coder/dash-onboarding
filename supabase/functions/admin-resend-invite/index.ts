import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  user_id: z.string().uuid(),
  channels: z.array(z.enum(["email", "whatsapp", "link_only"])).min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_operations_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { user_id, channels } = parsed.data;

    // Look up target user
    const { data: target, error: tErr } = await admin.auth.admin.getUserById(user_id);
    if (tErr || !target.user?.email) return json({ error: tErr?.message ?? "user_not_found" }, 404);
    const email = target.user.email;
    const full_name = (target.user.user_metadata?.full_name as string | undefined) ?? null;

    // Look up role/agente from operations table
    const { data: opRow } = await admin
      .from("user_roles_operations")
      .select("role, agente_ativacao")
      .eq("user_id", user_id)
      .maybeSingle();

    // Always send users to the operations dashboard, regardless of where the
    // admin clicked "Resend invite" (this Supabase project is shared with the
    // commercial dashboard, so we cannot rely on the request origin).
    const APP_URL =
      Deno.env.get("OPERATIONS_APP_URL") ?? "https://dash-onboarding-three.vercel.app";
    const redirectTo = `${APP_URL.replace(/\/$/, "")}/acesso-dash`;

    // Decide link type: invite if not yet confirmed, otherwise recovery (reset password)
    const linkType: "invite" | "recovery" = target.user.email_confirmed_at ? "recovery" : "invite";
    const sendEmail = channels.includes("email");

    // generateLink doesn't send email; only inviteUserByEmail / resetPasswordForEmail do
    let action_link: string | null = null;
    if (sendEmail && linkType === "invite") {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
      if (invErr) return json({ error: invErr.message }, 400);
      action_link = (inv as { properties?: { action_link?: string } })?.properties?.action_link ?? null;
      if (!action_link) {
        const { data: gl } = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
        action_link = gl?.properties?.action_link ?? null;
      }
    } else {
      const { data: gl, error: glErr } = await admin.auth.admin.generateLink({
        type: linkType,
        email,
        options: { redirectTo },
      });
      if (glErr) return json({ error: glErr.message }, 400);
      action_link = gl?.properties?.action_link ?? null;

      // For email channel + recovery type, trigger an actual email
      if (sendEmail && linkType === "recovery") {
        await userClient.auth.resetPasswordForEmail(email, { redirectTo });
      }
    }

    if (!action_link) return json({ error: "no_link_generated" }, 500);

    // ─── Safety check: ensure the generated link will redirect to the
    // operations dashboard, NOT to the commercial dashboard (Site URL fallback).
    const validation = validateRedirect(action_link, APP_URL);
    if (!validation.ok) {
      console.error("invalid_redirect", validation);
      return json(
        {
          error: "invalid_redirect_target",
          message:
            `O link gerado redirecionaria para "${validation.actual ?? "(vazio)"}" em vez de "${APP_URL}". ` +
            `Adicione "${APP_URL.replace(/\/$/, "")}/**" em Authentication → URL Configuration → Redirect URLs no Supabase.`,
          expected: APP_URL,
          actual: validation.actual,
          reason: validation.reason,
        },
        500,
      );
    }

    // Shorten via is.gd — tenta usar alias customizado "invite-acesso-XXXXX"
    // (precisa ser único globalmente no is.gd; faz fallback para alias gerado).
    let short_link: string | null = null;
    const tryShorten = async (alias?: string) => {
      const params = new URLSearchParams({ format: "simple", url: action_link! });
      if (alias) params.set("shorturl", alias);
      const r = await fetch(`https://is.gd/create.php?${params.toString()}`);
      const txt = (await r.text()).trim();
      return r.ok && txt.startsWith("http") ? txt : null;
    };
    try {
      // 5 tentativas com sufixo aleatório curto para evitar colisão
      for (let i = 0; i < 5 && !short_link; i++) {
        const suffix = Math.random().toString(36).slice(2, 7);
        short_link = await tryShorten(`acesso-dash-${suffix}`);
      }
      // Fallback: alias automático
      if (!short_link) short_link = await tryShorten();
    } catch (e) {
      console.error("shorten_failed", (e as Error).message);
    }

    // Webhook (whatsapp)
    if (channels.includes("whatsapp")) {
      try {
        await fetch("https://webhook.takeat.cloud/webhook/dash-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "operator.invite_resent",
            user_id,
            email,
            full_name,
            role: opRow?.role ?? null,
            agente_ativacao: opRow?.agente_ativacao ?? null,
            action_link: short_link ?? action_link,
            action_link_full: action_link,
            link_type: linkType,
            channels,
            invited_by: userData.user.id,
            invited_by_email: userData.user.email ?? null,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.error("webhook_failed", (e as Error).message);
      }
    }

    return json({
      ok: true,
      email,
      action_link,
      short_link,
      link_type: linkType,
      channels,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Parse Supabase's verify URL and confirm that:
 * 1. There is a `redirect_to` query param (Supabase only includes it when our
 *    requested redirectTo is in the allow-list — otherwise it silently falls
 *    back to Site URL, which would land on the wrong dashboard).
 * 2. That `redirect_to` host matches the expected operations APP_URL host.
 */
function validateRedirect(
  actionLink: string,
  appUrl: string,
): { ok: true } | { ok: false; reason: string; actual: string | null } {
  let url: URL;
  let expected: URL;
  try {
    url = new URL(actionLink);
    expected = new URL(appUrl);
  } catch {
    return { ok: false, reason: "unparsable_url", actual: actionLink };
  }
  const redirectTo = url.searchParams.get("redirect_to");
  if (!redirectTo) {
    return {
      ok: false,
      reason: "missing_redirect_to_param_supabase_fallback_to_site_url",
      actual: null,
    };
  }
  let target: URL;
  try {
    target = new URL(redirectTo);
  } catch {
    return { ok: false, reason: "redirect_to_invalid_url", actual: redirectTo };
  }
  if (target.host !== expected.host) {
    return { ok: false, reason: "host_mismatch", actual: redirectTo };
  }
  return { ok: true };
}
