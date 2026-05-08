import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const slaBand = (d: number) =>
  d > 30 ? "critico" : d > 15 ? "atencao" : d > 7 ? "alerta" : "saudavel";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pagina dash_operacoes
    const all: any[] = [];
    let from = 0;
    const STEP = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("dash_operacoes")
        .select("agente_ativacao,etapa_negocio,sla_dias,mrr")
        .range(from, from + STEP - 1);
      if (error) throw error;
      if (!data?.length) break;
      all.push(...data);
      if (data.length < STEP) break;
      from += STEP;
    }

    const total = all.length;
    let mrrTotal = 0;
    let slaSum = 0;
    let noPrazo = 0;
    const bands = { critico: 0, atencao: 0, alerta: 0, saudavel: 0 };
    const etapaMap = new Map<string, { count: number; mrr: number }>();
    const ativMap = new Map<string, { count: number; mrr: number; bands: typeof bands }>();

    for (const r of all) {
      const sla = toNum(r.sla_dias);
      const mrr = toNum(r.mrr);
      mrrTotal += mrr;
      slaSum += sla;
      if (sla <= 30) noPrazo++;
      const b = slaBand(sla);
      bands[b]++;

      const e = (r.etapa_negocio ?? "Sem etapa").trim();
      const ec = etapaMap.get(e) ?? { count: 0, mrr: 0 };
      ec.count++;
      ec.mrr += mrr;
      etapaMap.set(e, ec);

      const a = (r.agente_ativacao ?? "Sem responsável").trim();
      const ac = ativMap.get(a) ?? { count: 0, mrr: 0, bands: { ...bands, critico: 0, atencao: 0, alerta: 0, saudavel: 0 } };
      ac.count++;
      ac.mrr += mrr;
      ac.bands[b]++;
      ativMap.set(a, ac);
    }

    const today = new Date().toISOString().slice(0, 10);
    const row = {
      snapshot_date: today,
      total,
      mrr_total: mrrTotal,
      sla_medio: total ? slaSum / total : 0,
      pct_no_prazo: total ? (noPrazo / total) * 100 : 0,
      band_critico: bands.critico,
      band_atencao: bands.atencao,
      band_alerta: bands.alerta,
      band_saudavel: bands.saudavel,
      por_etapa: [...etapaMap.entries()].map(([etapa, v]) => ({ etapa, ...v })),
      por_ativador: [...ativMap.entries()].map(([ativador, v]) => ({ ativador, ...v })),
    };

    const { error: upErr } = await supabase
      .from("dash_operacoes_snapshots")
      .upsert(row, { onConflict: "snapshot_date" });
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, snapshot_date: today, total }),
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
