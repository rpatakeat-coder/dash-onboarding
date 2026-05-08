import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PESO_ETAPA: Record<string, number> = {
  "Pré-Cancelamento": 5,
  Inativo: 4,
  Pendências: 3,
  "Processo Pausado": 3,
  Treinamento: 1.2,
  Configuração: 1.2,
  Acompanhamento: 0.6,
};
const PESO_PERFIL: Record<string, number> = { GG: 2.5, G: 2, M: 1.3, P: 1 };

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const perfilOf = (s: unknown) =>
  (String(s ?? "").trim().split(/\s+/)[0] || "—").toUpperCase();

interface DealRow {
  id_deal: number;
  nome_negocio: string | null;
  agente_ativacao: string | null;
  etapa_negocio: string | null;
  perfil_cliente: string | null;
  sla_dias: string | null;
  mrr: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const webhook = Deno.env.get("N8N_DAILY_ALERT_WEBHOOK_URL");
    if (!webhook) throw new Error("N8N_DAILY_ALERT_WEBHOOK_URL not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Carregar deals
    const all: DealRow[] = [];
    let from = 0;
    const STEP = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("dash_operacoes")
        .select(
          "id_deal,nome_negocio,agente_ativacao,etapa_negocio,perfil_cliente,sla_dias,mrr",
        )
        .range(from, from + STEP - 1);
      if (error) throw error;
      if (!data?.length) break;
      all.push(...(data as DealRow[]));
      if (data.length < STEP) break;
      from += STEP;
    }

    // 2) Resumo atual
    const total = all.length;
    let mrrTotal = 0,
      slaSum = 0,
      noPrazo = 0,
      criticos = 0;
    for (const r of all) {
      const sla = toNum(r.sla_dias);
      mrrTotal += toNum(r.mrr);
      slaSum += sla;
      if (sla <= 30) noPrazo++;
      if (sla > 30) criticos++;
    }
    const summary = {
      total,
      mrr_total: Math.round(mrrTotal),
      sla_medio: total ? +(slaSum / total).toFixed(1) : 0,
      pct_no_prazo: total ? +((noPrazo / total) * 100).toFixed(1) : 0,
      criticos,
    };

    // 3) Diff vs último snapshot
    const { data: lastSnaps } = await supabase
      .from("dash_operacoes_snapshots")
      .select("snapshot_date,total,mrr_total,sla_medio,pct_no_prazo,band_critico")
      .order("snapshot_date", { ascending: false })
      .limit(1);
    const last = lastSnaps?.[0];
    const diff = last
      ? {
          since: last.snapshot_date,
          total: summary.total - last.total,
          mrr_total: Math.round(summary.mrr_total - Number(last.mrr_total)),
          sla_medio: +(summary.sla_medio - Number(last.sla_medio)).toFixed(1),
          pct_no_prazo: +(summary.pct_no_prazo - Number(last.pct_no_prazo)).toFixed(1),
          criticos: summary.criticos - last.band_critico,
        }
      : null;

    // 4) Top 10 risco
    const scored = all
      .map((r) => {
        const sla = toNum(r.sla_dias);
        const mrr = toNum(r.mrr);
        const pe = PESO_ETAPA[(r.etapa_negocio ?? "").trim()] ?? 1;
        const pp = PESO_PERFIL[perfilOf(r.perfil_cliente)] ?? 1;
        const score = sla * pe * pp * (1 + Math.log10(1 + mrr) / 4);
        return { r, sla, mrr, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x, i) => ({
        rank: i + 1,
        id_deal: x.r.id_deal,
        cliente: x.r.nome_negocio?.trim() || "—",
        ativador: x.r.agente_ativacao?.trim() || "—",
        etapa: x.r.etapa_negocio?.trim() || "—",
        perfil: perfilOf(x.r.perfil_cliente),
        sla_dias: Math.round(x.sla),
        mrr: Math.round(x.mrr),
        score: Math.round(x.score),
        hubspot_url: `https://app.hubspot.com/contacts/_/deal/${x.r.id_deal}`,
      }));

    const payload = {
      date: new Date().toISOString().slice(0, 10),
      generated_at: new Date().toISOString(),
      summary,
      diff_vs_last_snapshot: diff,
      top_risco: scored,
    };

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Webhook ${res.status}: ${text.slice(0, 200)}`);

    return new Response(
      JSON.stringify({ ok: true, sent: scored.length, webhook_status: res.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
