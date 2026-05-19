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

// Rate limit: 20 req/min per user (cold-start memory)
const rl = new Map<string, number[]>();
const rateLimit = (uid: string, limit = 20, win = 60_000) => {
  const now = Date.now();
  const arr = (rl.get(uid) ?? []).filter((t) => now - t < win);
  if (arr.length >= limit) return false;
  arr.push(now);
  rl.set(uid, arr);
  return true;
};

const Body = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .default([]),
});

// ---------- Helpers de dados ----------
const numFrom = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const norm = (v: unknown) => String(v ?? "").trim();
const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

type Row = Record<string, unknown>;

const ONBOARDING = "onboarding";
const isOnboarding = (r: Row) => slug(String(r.pipeline_nome ?? "")).includes(ONBOARDING);
const isAtivado = (r: Row) => slug(String(r.etapa_negocio ?? "")) === "ativado";

// ---------- Tools ----------
const tools = [
  {
    type: "function",
    function: {
      name: "consultar_deals",
      description:
        "Lista deals do estoque de Onboarding com filtros opcionais. Retorna no máximo 25 deals, ordenados por SLA decrescente.",
      parameters: {
        type: "object",
        properties: {
          ativador: { type: "string", description: "Nome (ou parte) do ativador/agente." },
          etapa: { type: "string", description: "Nome (ou parte) da etapa." },
          dias_minimo: { type: "number", description: "SLA mínimo na etapa (dias)." },
          dias_maximo: { type: "number" },
          perfil: { type: "string", description: "Perfil do cliente (ex.: Light, Pro)." },
          apenas_criticos: { type: "boolean", description: "Se true, retorna só >= 30 dias." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kpis_periodo",
      description:
        "Resumo dos principais KPIs operacionais: estoque atual, MRR sob gestão, SLA médio, % no prazo, distribuição por banda, ativações no mês informado.",
      parameters: {
        type: "object",
        properties: {
          mes: {
            type: "string",
            description:
              "Mês de referência para ativações no formato MM/AAAA (ex.: 05/2026). Se omitido, usa o mês atual.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stats_ativador",
      description:
        "Performance do ativador: nº de clientes em carteira, MRR gerido, SLA médio, distribuição por banda e top 5 deals mais críticos.",
      parameters: {
        type: "object",
        properties: {
          ativador: { type: "string", description: "Nome (ou parte) do ativador. Obrigatório." },
        },
        required: ["ativador"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comparar_periodos",
      description:
        "Compara ativações (qtd e MRR) entre dois meses no formato MM/AAAA. Calcula deltas absoluto e percentual.",
      parameters: {
        type: "object",
        properties: {
          mes_a: { type: "string", description: "Mês A no formato MM/AAAA" },
          mes_b: { type: "string", description: "Mês B no formato MM/AAAA" },
        },
        required: ["mes_a", "mes_b"],
        additionalProperties: false,
      },
    },
  },
];

// ---------- Tool implementations ----------
async function fetchAllRows(
  client: ReturnType<typeof createClient>,
): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await client
      .from("dash_operacoes")
      .select(
        "id_deal, nome_negocio, etapa_negocio, agente_ativacao, perfil_cliente, mrr, sla_dias_etapa, sla_dias_real, mes_ano_ativacao, pipeline_nome",
      )
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return out;
}

const bandOf = (sla: number) =>
  sla >= 30 ? "critico" : sla >= 21 ? "atencao" : sla >= 11 ? "alerta" : "saudavel";

function execConsultarDeals(rows: Row[], args: Record<string, unknown>) {
  const ativador = slug(String(args.ativador ?? ""));
  const etapa = slug(String(args.etapa ?? ""));
  const perfil = slug(String(args.perfil ?? ""));
  const dMin = typeof args.dias_minimo === "number" ? args.dias_minimo : null;
  const dMax = typeof args.dias_maximo === "number" ? args.dias_maximo : null;
  const onlyCrit = Boolean(args.apenas_criticos);

  const filtered = rows
    .filter(isOnboarding)
    .filter((r) => {
      const sla = numFrom(r.sla_dias_etapa);
      if (ativador && !slug(String(r.agente_ativacao ?? "")).includes(ativador)) return false;
      if (etapa && !slug(String(r.etapa_negocio ?? "")).includes(etapa)) return false;
      if (perfil && !slug(String(r.perfil_cliente ?? "")).includes(perfil)) return false;
      if (dMin != null && sla < dMin) return false;
      if (dMax != null && sla > dMax) return false;
      if (onlyCrit && sla < 30) return false;
      return true;
    })
    .map((r) => ({
      id: Number(r.id_deal),
      cliente: norm(r.nome_negocio),
      etapa: norm(r.etapa_negocio),
      ativador: norm(r.agente_ativacao) || null,
      perfil: norm(r.perfil_cliente) || null,
      mrr: numFrom(r.mrr),
      sla_dias: Math.round(numFrom(r.sla_dias_etapa)),
      banda: bandOf(numFrom(r.sla_dias_etapa)),
    }))
    .sort((a, b) => b.sla_dias - a.sla_dias);

  return {
    total_encontrado: filtered.length,
    mostrando: Math.min(25, filtered.length),
    deals: filtered.slice(0, 25),
  };
}

function execKpisPeriodo(rows: Row[], args: Record<string, unknown>) {
  const now = new Date();
  const mes =
    norm(args.mes) ||
    `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const estoque = rows.filter(isOnboarding);
  const slas = estoque.map((r) => numFrom(r.sla_dias_etapa));
  const slaMedio = slas.length ? slas.reduce((a, b) => a + b, 0) / slas.length : 0;
  const noPrazo = slas.filter((s) => s <= 20).length;

  const bands = { critico: 0, atencao: 0, alerta: 0, saudavel: 0 };
  for (const s of slas) bands[bandOf(s) as keyof typeof bands]++;

  const ativadosMes = rows.filter(
    (r) => isAtivado(r) && norm(r.mes_ano_ativacao) === mes,
  );
  const mrrAtivado = ativadosMes.reduce((s, r) => s + numFrom(r.mrr), 0);

  return {
    estoque_atual: estoque.length,
    mrr_sob_gestao: estoque.reduce((s, r) => s + numFrom(r.mrr), 0),
    sla_medio_dias: Number(slaMedio.toFixed(1)),
    pct_no_prazo: estoque.length ? Number(((noPrazo / estoque.length) * 100).toFixed(1)) : 0,
    distribuicao_bandas: bands,
    mes_referencia: mes,
    ativacoes_no_mes: ativadosMes.length,
    mrr_ativado_no_mes: Math.round(mrrAtivado),
  };
}

function execStatsAtivador(rows: Row[], args: Record<string, unknown>) {
  const q = slug(String(args.ativador ?? ""));
  if (!q) return { error: "ativador é obrigatório" };

  const carteira = rows
    .filter(isOnboarding)
    .filter((r) => slug(String(r.agente_ativacao ?? "")).includes(q));
  if (!carteira.length) return { encontrado: false, mensagem: `Ativador "${args.ativador}" não tem deals em Onboarding.` };

  const slas = carteira.map((r) => numFrom(r.sla_dias_etapa));
  const slaMedio = slas.reduce((a, b) => a + b, 0) / slas.length;
  const bands = { critico: 0, atencao: 0, alerta: 0, saudavel: 0 };
  for (const s of slas) bands[bandOf(s) as keyof typeof bands]++;

  const top5 = carteira
    .map((r) => ({
      id: Number(r.id_deal),
      cliente: norm(r.nome_negocio),
      etapa: norm(r.etapa_negocio),
      sla_dias: Math.round(numFrom(r.sla_dias_etapa)),
      mrr: numFrom(r.mrr),
    }))
    .sort((a, b) => b.sla_dias - a.sla_dias)
    .slice(0, 5);

  return {
    encontrado: true,
    nome_real: norm(carteira[0].agente_ativacao),
    clientes: carteira.length,
    mrr_total: Math.round(carteira.reduce((s, r) => s + numFrom(r.mrr), 0)),
    sla_medio_dias: Number(slaMedio.toFixed(1)),
    distribuicao_bandas: bands,
    top5_criticos: top5,
  };
}

function execCompararPeriodos(rows: Row[], args: Record<string, unknown>) {
  const a = norm(args.mes_a);
  const b = norm(args.mes_b);
  const summarize = (mes: string) => {
    const r = rows.filter((x) => isAtivado(x) && norm(x.mes_ano_ativacao) === mes);
    return {
      mes,
      ativacoes: r.length,
      mrr_ativado: Math.round(r.reduce((s, x) => s + numFrom(x.mrr), 0)),
    };
  };
  const A = summarize(a);
  const B = summarize(b);
  const pct = (x: number, y: number) => (y === 0 ? null : Number((((x - y) / y) * 100).toFixed(1)));
  return {
    a: A,
    b: B,
    delta_ativacoes: A.ativacoes - B.ativacoes,
    delta_pct_ativacoes: pct(A.ativacoes, B.ativacoes),
    delta_mrr: A.mrr_ativado - B.mrr_ativado,
    delta_pct_mrr: pct(A.mrr_ativado, B.mrr_ativado),
  };
}

const DEFAULT_SYSTEM = `Você é o Copiloto de Operações da Takeat — analista sênior de Onboarding.
Responda SEMPRE em pt-BR, com tom executivo e analítico.

USE EXATAMENTE ESTA ESTRUTURA EM MARKDOWN. Cada título começa com "### " (heading H3) e DEVE ter uma LINHA EM BRANCO antes e depois — sem isso a renderização fica colada:

### Resumo

Uma frase com a conclusão principal. Use **negrito** nos números-chave.

### Destaques

- Bullet curto com 1 insight (padrão, concentração, outlier).
- Bullet curto com outro insight.
- (3-4 bullets no máximo)

### Detalhe

(Opcional — só se ajudar a decisão ou se o usuário pediu lista.)
Tabela markdown compacta, máx 8 linhas. Se houver mais, escreva "mostrando 8 de N" abaixo.
Sempre use a sintaxe completa de tabela markdown com pipes \`|\` e linha separadora \`|---|---|\`.

### Próximo passo

Uma pergunta ou ação concreta. Ex.: "Quer que eu filtre por ativador?"

REGRAS DURAS DE FORMATAÇÃO:
- SEMPRE use \`### Título\` (heading H3) para as seções — NUNCA \`**Título**\` em negrito.
- SEMPRE deixe UMA LINHA EM BRANCO entre o título e o conteúdo, e entre blocos.
- SEMPRE use bullets "- " reais em linhas separadas (não parágrafos colados).
- Valores monetários: R$ 18.450 (separador de milhar, sem centavos).
- SLA com sufixo "d": 160d.
- NUNCA invente números — use sempre as ferramentas.
- NUNCA cuspa JSON ou listas longas sem contexto.
- Se a pergunta for ambígua, pergunte 1 detalhe antes de chamar ferramentas.
- Se a ferramenta retornar 0/erro, explique e proponha alternativa.

Pense como analista ajudando um head de operações a decidir.`;

async function loadSystemPrompt(client: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await client
      .from("app_settings")
      .select("value")
      .eq("key", "copilot.system_prompt")
      .maybeSingle();
    const v = data?.value as { prompt?: string } | null;
    const custom = v?.prompt?.trim();
    return custom && custom.length > 0 ? custom : DEFAULT_SYSTEM;
  } catch {
    return DEFAULT_SYSTEM;
  }
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

    if (!rateLimit(userData.user.id))
      return json({ error: "rate_limited", message: "Muitas mensagens em pouco tempo. Aguarde alguns segundos." }, 429);

    // Verifica papel (admin/super_admin têm acesso total; demais ficam restritos ao próprio agente)
    const { data: isAdminData } = await userClient.rpc("has_operations_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    const isAdmin = Boolean(isAdminData);

    // Nome do agente do usuário (para usuários comuns)
    let userAgente = "";
    if (!isAdmin) {
      const { data: agenteData } = await userClient.rpc("current_user_agente");
      userAgente = norm(agenteData);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "missing_api_key", message: "OPENAI_API_KEY não configurada." }, 500);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);

    // Carrega rows uma vez por requisição (RLS aplicada — ativadores só recebem suas próprias linhas)
    const rows = await fetchAllRows(userClient);

    const SYSTEM_BASE = await loadSystemPrompt(userClient);
    const SYSTEM = isAdmin
      ? SYSTEM_BASE
      : `${SYSTEM_BASE}\n\nESCOPO DO USUÁRIO: você está conversando com o ativador "${userAgente}". Considere apenas a carteira dele. Não cite outros ativadores; se perguntado, responda que não tem acesso a dados de outras pessoas.`;

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: SYSTEM },
      ...parsed.data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: parsed.data.message },
    ];

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const callOpenAI = async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 900,
          tools,
          tool_choice: "auto",
          messages,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let message = "Falha ao chamar a OpenAI.";
        if (res.status === 401) message = "Chave OpenAI inválida.";
        else if (res.status === 429) message = "Limite OpenAI atingido. Tente em alguns minutos.";
        else if (res.status === 402 || /insufficient_quota/i.test(errText))
          message = "Créditos OpenAI esgotados.";
        console.error("[copilot-chat] openai_error", res.status, errText);
        throw new Error(message);
      }
      return res.json();
    };

    // Para usuários não-admin, força o filtro de ativador para o próprio agente
    const enforceScope = (a: Record<string, unknown>): Record<string, unknown> => {
      if (isAdmin) return a;
      return { ...a, ativador: userAgente };
    };

    const toolsExec: Record<string, (a: Record<string, unknown>) => unknown> = {
      consultar_deals: (a) => execConsultarDeals(rows, enforceScope(a)),
      kpis_periodo: (a) => execKpisPeriodo(rows, a),
      stats_ativador: (a) => execStatsAtivador(rows, enforceScope(a)),
      comparar_periodos: (a) => execCompararPeriodos(rows, a),
    };

    const toolsUsed: Array<{ name: string; args: unknown }> = [];
    let final = "";
    let usage: unknown = null;

    for (let iter = 0; iter < 4; iter++) {
      const completion = await callOpenAI();
      usage = completion.usage ?? usage;
      const msg = completion.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          let result: unknown;
          try {
            const args = JSON.parse(call.function.arguments || "{}");
            const fn = toolsExec[call.function.name];
            result = fn ? fn(args) : { error: `unknown tool ${call.function.name}` };
            toolsUsed.push({ name: call.function.name, args });
          } catch (e) {
            result = { error: (e as Error).message };
          }
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      final = msg.content ?? "";
      break;
    }

    if (!final) final = "Não consegui gerar uma resposta. Tente reformular a pergunta.";

    return json({ content: final, toolsUsed, model, usage });
  } catch (e) {
    console.error("[copilot-chat] unexpected", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
