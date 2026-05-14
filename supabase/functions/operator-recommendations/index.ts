import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const Body = z.object({
  ativador: z.string().min(1).max(120),
  payload: z.object({
    clientes: z.number(),
    mrr: z.number(),
    sla_medio: z.number(),
    bands: z.object({
      critico: z.number(),
      atencao: z.number(),
      alerta: z.number(),
      saudavel: z.number(),
    }),
    media_carteira_geral: z.number().optional(),
    sla_medio_geral: z.number().optional(),
    top_criticos: z
      .array(
        z.object({
          cliente: z.string(),
          etapa: z.string(),
          sla_dias: z.number(),
          mrr: z.number().optional(),
        }),
      )
      .max(8)
      .default([]),
  }),
});

const SYSTEM = [
  "Você é um coach de operações de Onboarding da Takeat.",
  "A partir dos dados de UM ativador, gere de 3 a 5 sugestões PRIORIZADAS, concretas e curtas.",
  "Cada sugestão deve ter o formato: '**Ação curta** — racional baseado no número específico fornecido.'.",
  "Use apenas os dados do payload. NUNCA invente clientes, números ou datas.",
  "Linguagem direta, em português, no máximo 18 palavras por sugestão.",
  "Saída em markdown como lista numerada (1., 2., ...). Nada além da lista.",
].join(" ");

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

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "missing_api_key", message: "OPENAI_API_KEY não configurada." }, 500);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);

    const { ativador, payload } = parsed.data;
    const userPrompt = [
      `Ativador: ${ativador}`,
      `Carteira: ${payload.clientes} clientes (média geral: ${payload.media_carteira_geral ?? "n/d"})`,
      `MRR sob gestão: R$ ${payload.mrr.toLocaleString("pt-BR")}`,
      `SLA médio: ${payload.sla_medio.toFixed(1)}d (geral: ${payload.sla_medio_geral?.toFixed(1) ?? "n/d"}d)`,
      `Distribuição por banda: críticos=${payload.bands.critico}, atenção=${payload.bands.atencao}, alerta=${payload.bands.alerta}, saudável=${payload.bands.saudavel}`,
      payload.top_criticos.length
        ? `Deals mais críticos:\n${payload.top_criticos
            .map((c) => `- ${c.cliente} (${c.etapa}, ${c.sla_dias}d${c.mrr ? `, R$ ${c.mrr}` : ""})`)
            .join("\n")}`
        : "Sem deals críticos.",
    ].join("\n");

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 350,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[operator-recommendations] openai_error", res.status, errText);
      let message = "Falha ao gerar sugestões.";
      if (res.status === 429) message = "Limite OpenAI atingido. Tente em alguns minutos.";
      else if (res.status === 402 || /insufficient_quota/i.test(errText))
        message = "Créditos OpenAI esgotados.";
      return json({ error: "openai_error", message }, 502);
    }

    const completion = await res.json();
    const content: string = completion.choices?.[0]?.message?.content ?? "";
    return json({ content, model, usage: completion.usage ?? null });
  } catch (e) {
    console.error("[operator-recommendations] unexpected", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
