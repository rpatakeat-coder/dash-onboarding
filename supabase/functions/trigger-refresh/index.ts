import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

// Dispara o webhook de atualização de dados (n8n) de forma protegida:
//  - exige usuário autenticado (bloqueia chamadas anônimas da internet);
//  - chama o n8n com um header secreto que vive só no servidor (Deno.env),
//    para o n8n recusar qualquer chamada que não venha daqui.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Eventos permitidos (evita usar a função pra disparar qualquer payload).
const Body = z.object({
  event: z.enum(["atualizar_dados", "atualizar_dados_sucesso"]),
});

const DEFAULT_WEBHOOK_URL = "https://webhook.takeat.cloud/webhook/dash-onboarding";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Valida a sessão do usuário (qualquer usuário logado pode atualizar).
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_event" }, 400);
    const { event } = parsed.data;

    const webhookUrl = Deno.env.get("N8N_REFRESH_WEBHOOK_URL") ?? DEFAULT_WEBHOOK_URL;
    const secret = Deno.env.get("N8N_REFRESH_SECRET");

    // Rollout sem downtime: a proteção de auth (acima) já vale desde o deploy.
    // O header secreto só é enviado quando N8N_REFRESH_SECRET estiver configurado
    // — aí o n8n pode passar a exigir/validar esse header (2ª camada).
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["X-Webhook-Secret"] = secret;

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, triggered_by: userData.user.id }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json({ error: `webhook_${resp.status}`, detail: text.slice(0, 200) }, 502);
    }

    return json({ ok: true });
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
