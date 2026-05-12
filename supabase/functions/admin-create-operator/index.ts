import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Body = z
  .object({
    email: z.string().email(),
    agente_ativacao: z.string().min(1).max(120).optional(),
    role: z.enum(["admin", "user"]).default("user"),
    full_name: z.string().max(120).optional(),
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
    const { email, agente_ativacao, role, full_name } = parsed.data;

    // Build redirect URL from request origin
    const origin = req.headers.get("origin") ?? "";
    const redirectTo = origin ? `${origin}/auth` : undefined;

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? "" },
      redirectTo,
    });
    if (inviteErr || !invited.user) return json({ error: inviteErr?.message ?? "invite_failed" }, 400);

    const newUserId = invited.user.id;

    // Ensure profile exists
    await admin.from("profiles").upsert(
      { id: newUserId, full_name: full_name ?? "", agente_ativacao },
      { onConflict: "id" },
    );

    const { error: roleInsertErr } = await admin
      .from("user_roles_operations")
      .upsert(
        { user_id: newUserId, role, agente_ativacao },
        { onConflict: "user_id" },
      );
    if (roleInsertErr) return json({ error: roleInsertErr.message }, 500);

    return json({ ok: true, user_id: newUserId });
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
