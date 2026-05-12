import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limit (per user, per cold start): 10 req/min
const rl = new Map<string, number[]>();
function rateLimit(userId: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const arr = (rl.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  rl.set(userId, arr);
  return true;
}

const KpiPayload = z.object({
  mode: z.literal("kpi"),
  payload: z.object({
    kpiName: z.string().min(1).max(120),
    valorAtual: z.union([z.string(), z.number()]),
    valorAnterior: z.union([z.string(), z.number()]).optional(),
    contexto: z.string().max(2000).optional(),
  }),
});

const DashboardPayload = z.object({
  mode: z.literal("dashboard"),
  payload: z.object({
    periodo: z.string().max(120).optional(),
    kpis: z.record(z.union([z.string(), z.number()])).default({}),
    operadores: z
      .array(
        z.object({
          nome: z.string(),
          ativos: z.number().optional(),
          criticos: z.number().optional(),
          slaMedio: z.number().optional(),
          mrr: z.number().optional(),
        }),
      )
      .max(50)
      .default([]),
    snapshotAnterior: z.record(z.union([z.string(), z.number()])).optional(),
  }),
});

const Body = z.union([KpiPayload, DashboardPayload]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(): string {
  return [
    "Você é um analista sênior de operações de Onboarding da Takeat.",
    "Responda SEMPRE em português brasileiro, tom executivo, direto, sem floreio.",
    "Não invente números. Use apenas os dados fornecidos no payload.",
    "Quando citar variações, sempre referencie a base (ex.: vs período anterior).",
    "Formate em markdown com bullets curtos e negrito nos termos-chave.",
  ].join(" ");
}

function buildDashboardPrompt(payload: z.infer<typeof DashboardPayload>["payload"]): string {
  return [
    `Período analisado: ${payload.periodo ?? "atual"}.`,
    `KPIs atuais:\n${JSON.stringify(payload.kpis, null, 2)}`,
    payload.snapshotAnterior
      ? `Snapshot anterior (referência):\n${JSON.stringify(payload.snapshotAnterior, null, 2)}`
      : "Sem snapshot anterior disponível.",
    `Top operadores (até 50):\n${JSON.stringify(payload.operadores, null, 2)}`,
    "",
    "Gere a resposta em markdown com EXATAMENTE estas duas seções e nada mais:",
    "",
    "## Resumo executivo",
    "- 3 a 5 bullets curtos explicando o estado da operação e as principais variações vs snapshot anterior. Quando houver delta relevante, explique a causa provável a partir dos dados.",
    "",
    "## Sugestões de ação por operador",
    "- Liste até 5 operadores prioritários (os mais críticos/em risco). Para cada um: **Nome** — ação recomendada concreta em 1 frase. Não invente operadores que não estão no payload.",
  ].join("\n");
}

function buildKpiPrompt(payload: z.infer<typeof KpiPayload>["payload"]): string {
  return [
    `KPI: ${payload.kpiName}`,
    `Valor atual: ${payload.valorAtual}`,
    payload.valorAnterior !== undefined ? `Valor anterior: ${payload.valorAnterior}` : "",
    payload.contexto ? `Contexto adicional: ${payload.contexto}` : "",
    "",
    "Em 2 a 3 frases curtas (markdown permitido), explique o que esse KPI significa, o que a variação indica e qual ação prática o time deve considerar. Não invente números.",
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "missing_auth" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);

    if (!rateLimit(userData.user.id)) {
      return json({ error: "rate_limited", message: "Muitas solicitações. Tente novamente em alguns instantes." }, 429);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "missing_api_key", message: "OPENAI_API_KEY não configurada." }, 500);

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
    }

    const isDashboard = parsed.data.mode === "dashboard";
    const userPrompt = isDashboard
      ? buildDashboardPrompt(parsed.data.payload)
      : buildKpiPrompt(parsed.data.payload);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: isDashboard ? 700 : 220,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      let message = "Falha ao chamar a OpenAI.";
      if (openaiRes.status === 401) message = "Chave OpenAI inválida ou sem permissão.";
      else if (openaiRes.status === 429) message = "Limite de uso da OpenAI atingido. Tente em alguns minutos.";
      else if (openaiRes.status === 402 || /insufficient_quota/i.test(errText))
        message = "Créditos da OpenAI esgotados. Recarregue a conta para continuar.";
      console.error("[ai-insights] openai_error", openaiRes.status, errText);
      return json({ error: "openai_error", status: openaiRes.status, message }, 502);
    }

    const completion = await openaiRes.json();
    const content: string = completion.choices?.[0]?.message?.content ?? "";
    const usage = completion.usage ?? null;

    // Best-effort audit log (don't fail the request if it errors)
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      await admin.from("audit_logs").insert({
        action: "ai_insights_generated",
        entity_type: "ai_insights",
        entity_id: parsed.data.mode,
        summary: `${parsed.data.mode} via ${model}`,
        metadata: { mode: parsed.data.mode, model, usage },
        user_id: userData.user.id,
      });
    } catch (e) {
      console.warn("[ai-insights] audit_log_failed", (e as Error).message);
    }

    return json({ content, model, usage, mode: parsed.data.mode });
  } catch (e) {
    console.error("[ai-insights] unexpected", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
