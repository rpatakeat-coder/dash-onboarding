import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z
  .object({
    email: z.string().email(),
    agente_ativacao: z.string().min(1).max(120).optional(),
    // super_admin nunca pode ser criado via UI
    role: z.enum(["admin", "user"]).default("user"),
    full_name: z.string().max(120).optional(),
    channels: z
      .array(z.enum(["email", "whatsapp", "link_only"]))
      .min(1)
      .default(["email"]),
  })
  .refine((v) => v.role === "admin" || (v.agente_ativacao && v.agente_ativacao.trim().length > 0), {
    message: "agente_ativacao is required for non-admin users",
    path: ["agente_ativacao"],
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

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
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
    const { email, agente_ativacao, role, full_name, channels } = parsed.data;

    // Hierarquia: somente super-admin pode criar outros admins.
    if (role === "admin") {
      const { data: isSuper } = await admin.rpc("has_operations_role", {
        _user_id: userData.user.id,
        _role: "super_admin",
      });
      if (!isSuper) return json({ error: "only_super_admin_can_create_admin" }, 403);
    }

    // Build redirect URL from request origin
    const origin = req.headers.get("origin") ?? "";
    const redirectTo = origin ? `${origin}/auth` : undefined;

    const sendEmail = channels.includes("email");
    let action_link: string | null = null;
    let newUserId: string | null = null;

    if (sendEmail) {
      // inviteUserByEmail envia email automaticamente via Supabase Auth
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: full_name ?? "" },
        redirectTo,
      });
      if (inviteErr || !invited.user) return json({ error: inviteErr?.message ?? "invite_failed" }, 400);
      newUserId = invited.user.id;
      action_link = (invited as { properties?: { action_link?: string } })?.properties?.action_link ?? null;
    } else {
      // Apenas gera link, sem enviar email
      const { data: invited, error: inviteErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { full_name: full_name ?? "" },
          redirectTo,
        },
      });
      if (inviteErr || !invited.user) return json({ error: inviteErr?.message ?? "invite_failed" }, 400);
      newUserId = invited.user.id;
      action_link = invited.properties?.action_link ?? null;
    }

    if (!newUserId) return json({ error: "invite_failed" }, 400);

    const agente = agente_ativacao ?? null;

    await admin.from("profiles").upsert(
      { id: newUserId, full_name: full_name ?? "", agente_ativacao: agente },
      { onConflict: "id" },
    );

    const { error: roleInsertErr } = await admin
      .from("user_roles_operations")
      .upsert(
        { user_id: newUserId, role, agente_ativacao: agente },
        { onConflict: "user_id" },
      );
    if (roleInsertErr) return json({ error: roleInsertErr.message }, 500);

    let short_link: string | null = null;
    if (action_link) {
      try {
        const tryShorten = async (shorturl?: string) => {
          const params = new URLSearchParams({ format: "simple", url: action_link! });
          if (shorturl) params.set("shorturl", shorturl);
          const r = await fetch(`https://is.gd/create.php?${params.toString()}`);
          const txt = (await r.text()).trim();
          return r.ok && txt.startsWith("http") ? txt : null;
        };

        for (let i = 0; i < 8 && !short_link; i++) {
          const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
          short_link = await tryShorten(`invite_acesso_${suffix}`);
        }

        if (!short_link) short_link = await tryShorten();
      } catch (e) {
        console.error("shorten_failed", (e as Error).message);
      }
    }

    try {
      await fetch("https://webhook.takeat.cloud/webhook/dash-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "operator.invited",
          user_id: newUserId,
          email,
          full_name: full_name ?? null,
          role,
          agente_ativacao: agente,
          action_link: short_link ?? action_link,
          action_link_full: action_link,
          invited_by: userData.user.id,
          invited_by_email: userData.user.email ?? null,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("webhook_failed", (e as Error).message);
    }

    return json({ ok: true, user_id: newUserId, action_link, short_link });
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
