import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashRow {
  id_deal: number;
  nome_negocio: string | null;
  perfil_cliente: string | null;
  mrr: string | null;
  /** MRR informado no Asaas (cobrança real). */
  mrr_asaas: string | null;
  /** ID do cliente/assinatura no Asaas. */
  asaas_id: string | null;
  agente_ativacao: string | null;
  /** SLA (dias) na etapa atual — vem de `sla_dias_etapa` na tabela. */
  sla_dias_etapa: string | null;
  /** SLA (dias) desde a criação do deal — vem de `sla_dias_criacao` na tabela. */
  sla_dias_criacao: string | null;
  /** SLA (dias) real — descontado o tempo em "Processo Pausado". Vem de `sla_dias_real`. */
  sla_dias_real: string | null;
  data_criacao: string | null;
  data_entrada_fase: string | null;
  etapa_negocio: string | null;
  data_ativacao: string | null;
  data_fechamento: string | null;
  etapa_de_cancelamento: string | null;
  pipeline_nome: string | null;
}

/**
 * Regra de Churn Real:
 * - etapa_negocio = "Churn"
 * - pipeline_nome = "Sucesso"
 * - etapa_de_cancelamento = "Onboarding"
 * (todas obrigatórias; corte de período por data_fechamento)
 */
export function isChurnRow(r: {
  etapa_negocio: string | null;
  pipeline_nome: string | null;
  etapa_de_cancelamento: string | null;
}): boolean {
  const etapa = (r.etapa_negocio ?? "").trim().toLowerCase();
  const pipeline = (r.pipeline_nome ?? "").trim().toLowerCase();
  const cancel = (r.etapa_de_cancelamento ?? "").trim().toLowerCase();
  return etapa === "churn" && pipeline === "sucesso" && cancel === "onboarding";
}

export interface ChurnKpis {
  /** 9% do MRR dos deals criados no mês vigente (referência de meta). */
  churnMaximo: number;
  /** MRR dos deals em Pré-Churn/Churn/Cancelamento com data_fechamento no mês vigente. */
  churnReal: number;
  /** Quantidade de deals em Churn Real. */
  churnRealCount: number;
  /** Soma de MRR dos deals criados no mês (base do Churn Máximo). */
  mrrCriadoMes: number;
  /** % do churn real sobre o churn máximo. */
  pctDoMaximo: number;
}

export function computeChurnKpis(
  rows: DashRow[],
  range?: { start: Date; end: Date },
): ChurnKpis {
  const now = new Date();
  const start = range?.start ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const end = range?.end ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const inRange = (raw: string | null) => {
    const d = parseDate(raw);
    return d ? d >= start && d < end : false;
  };

  const mrrCriadoMes = rows
    .filter((r) => inRange(r.data_criacao))
    .reduce((s, r) => s + toNum(r.mrr), 0);
  const churnMaximo = mrrCriadoMes * 0.09;

  const churnRows = rows.filter((r) => isChurnRow(r) && inRange(r.data_fechamento));
  const churnReal = churnRows.reduce((s, r) => s + toNum(r.mrr), 0);
  const pctDoMaximo = churnMaximo > 0 ? (churnReal / churnMaximo) * 100 : 0;

  return {
    churnMaximo,
    churnReal,
    churnRealCount: churnRows.length,
    mrrCriadoMes,
    pctDoMaximo,
  };
}

export type SlaBand = "critico" | "atencao" | "alerta" | "saudavel";

export const slaBand = (dias: number): SlaBand => {
  if (dias > 30) return "critico";
  if (dias === 30) return "atencao";
  if (dias >= 21) return "alerta";
  return "saudavel";
};

export const SLA_BAND_META: Record<
  SlaBand,
  { label: string; range: string; cssVar: string; order: number }
> = {
  critico: { label: "Crítico", range: ">30 dias", cssVar: "--sla-critico", order: 0 },
  atencao: { label: "Atenção", range: "= 30 dias", cssVar: "--sla-atencao", order: 1 },
  alerta: { label: "Alerta", range: "21–29 dias", cssVar: "--sla-alerta", order: 2 },
  saudavel: { label: "Saudável", range: "≤ 20 dias", cssVar: "--sla-saudavel", order: 3 },
};

export interface OperatorClient {
  id: number;
  cliente: string;
  etapa: string;
  perfil: string;
  sla: number;
  mrr: number;
  band: SlaBand;
}

export interface OperatorStat {
  nome: string;
  ativos: number;
  mrr: number;
  tempoMedio: number;
  travados: number;
  bands: Record<SlaBand, number>;
  bandsMrr: Record<SlaBand, number>;
  clientes: OperatorClient[];
}

export interface StalledRow {
  id: number;
  cliente: string;
  ativador: string;
  etapa: string;
  dias: number;
}

export interface PeriodStat {
  novos: number;
  ativados: number;
  mrrTotal: number;
  mrrAtivado: number;
  pctAtivado: number;
}

export interface PerfilStat {
  perfil: string;
  count: number;
  pct: number;
  mrr: number;
}

export interface DashData {
  rows: DashRow[];
  total: number;
  totalDb?: number;
  mrrTotal: number;
  tempoMedioFase: number;
  travados: number;
  // SLA
  slaMedio: number;
  slaP75: number;
  noPrazo: number;
  noPrazoCount: number;
  estourado: number;
  estouradoCount: number;
  // Period
  hoje: PeriodStat;
  semana: PeriodStat;
  mes: PeriodStat;
  mesAnterior: PeriodStat;
  // Perfil
  perfis: PerfilStat[];
  // Atenção
  atencao: { etapa: string; count: number; mrr: number; tone: "danger" | "warning" }[];
  criticos: StalledRow[];
  topMrrTravado: (StalledRow & { mrr: number })[];
  // Charts
  porEtapa: { etapa: string; count: number; mrr: number }[];
  operadores: OperatorStat[];
  travadosLista: StalledRow[];
}

const ETAPA_ATIVADO = "Acompanhamento";
const TRAVADO_DIAS = 7;
const SLA_PRAZO = 30;

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * SLA "real" do deal na etapa atual.
 * Prefere `sla_dias_real` (já desconta tempo em Processo Pausado);
 * se ausente/vazio, faz fallback para `sla_dias_etapa`.
 */
export const slaReal = (r: { sla_dias_real?: string | null; sla_dias_etapa?: string | null }) => {
  const raw = r.sla_dias_real;
  if (raw != null && String(raw).trim() !== "") return toNum(raw);
  return toNum(r.sla_dias_etapa);
};

/**
 * `data_ativacao` chega persistida em UTC (21:00), mas o dashboard precisa
 * agrupar pelo dia/mês local do HubSpot (UTC-3 → meia-noite do dia seguinte).
 */
export const parseActivationDate = (s: string | null): Date | null => {
  const d = parseDate(s);
  if (!d) return null;
  return new Date(d.getTime() + 3 * 60 * 60 * 1000);
};

export const formatActivationDate = (s: string | null): string => {
  const d = parseActivationDate(s);
  if (!d) return s?.trim() || "";
  return d.toLocaleDateString("pt-BR");
};

const emptyBands = (): Record<SlaBand, number> => ({
  critico: 0, atencao: 0, alerta: 0, saudavel: 0,
});

function buildOperadores(rows: DashRow[]): OperatorStat[] {
  const map = new Map<string, {
    ativos: number; mrr: number; soma: number; travados: number;
    bands: Record<SlaBand, number>;
    bandsMrr: Record<SlaBand, number>;
    clientes: OperatorClient[];
  }>();
  for (const r of rows) {
    const k = r.agente_ativacao?.trim() || "Sem responsável";
    const cur = map.get(k) ?? {
      ativos: 0, mrr: 0, soma: 0, travados: 0,
      bands: emptyBands(), bandsMrr: emptyBands(), clientes: [],
    };
    const d = slaReal(r);
    const m = toNum(r.mrr);
    const band = slaBand(d);
    cur.ativos += 1;
    cur.mrr += m;
    cur.soma += d;
    if (d > TRAVADO_DIAS) cur.travados += 1;
    cur.bands[band] += 1;
    cur.bandsMrr[band] += m;
    cur.clientes.push({
      id: r.id_deal,
      cliente: r.nome_negocio?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      perfil: (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase(),
      sla: d,
      mrr: m,
      band,
    });
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([nome, v]) => ({
      nome,
      ativos: v.ativos,
      mrr: v.mrr,
      tempoMedio: v.ativos ? v.soma / v.ativos : 0,
      travados: v.travados,
      bands: v.bands,
      bandsMrr: v.bandsMrr,
      clientes: v.clientes.sort((a, b) => b.sla - a.sla),
    }))
    .sort((a, b) => b.bands.critico - a.bands.critico || b.ativos - a.ativos);
}

export const parseDate = (s: string | null): Date | null => {
  if (!s) return null;
  const str = s.trim();
  if (!str) return null;
  // Formato BR: "DD/MM/YYYY[ HH:MM[:SS]]"
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = br;
    const d = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
    return isNaN(d.getTime()) ? null : d;
  }
  // Formato ISO "YYYY-MM-DD[ HH:MM]"
  const iso = str.includes("T") ? str : str.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = sun
  const diff = day === 0 ? 6 : day - 1; // semana começa na seg
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function periodStat(rows: DashRow[], start: Date, end: Date): PeriodStat {
  const inRange = rows.filter((r) => {
    const d = parseDate(r.data_criacao);
    return d && d >= start && d < end;
  });
  const novos = inRange.length;
  const ativados = inRange.filter((r) => r.etapa_negocio?.trim() === ETAPA_ATIVADO).length;
  const mrrTotal = inRange.reduce((s, r) => s + toNum(r.mrr), 0);
  const mrrAtivado = inRange
    .filter((r) => r.etapa_negocio?.trim() === ETAPA_ATIVADO)
    .reduce((s, r) => s + toNum(r.mrr), 0);
  const pctAtivado = mrrTotal > 0 ? (mrrAtivado / mrrTotal) * 100 : 0;
  return { novos, ativados, mrrTotal, mrrAtivado, pctAtivado };
}

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export interface FilteredData {
  atencao: { etapa: string; count: number; mrr: number; tone: "danger" | "warning" }[];
  criticos: StalledRow[];
  topMrrTravado: (StalledRow & { mrr: number })[];
  operadores: OperatorStat[];
}

export function computeFiltered(rows: DashRow[]): FilteredData {
  // Pontos de atenção
  const etapaMap = new Map<string, { count: number; mrr: number }>();
  for (const r of rows) {
    const k = r.etapa_negocio?.trim() || "Sem etapa";
    const cur = etapaMap.get(k) ?? { count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += toNum(r.mrr);
    etapaMap.set(k, cur);
  }
  const atencaoEtapas: { etapa: string; tone: "danger" | "warning" }[] = [
    { etapa: "Pré-Cancelamento", tone: "danger" },
    { etapa: "Inativo", tone: "danger" },
    { etapa: "Pendências", tone: "warning" },
    { etapa: "Processo Pausado", tone: "warning" },
  ];
  const atencao = atencaoEtapas
    .map(({ etapa, tone }) => {
      const v = etapaMap.get(etapa);
      return { etapa, tone, count: v?.count ?? 0, mrr: v?.mrr ?? 0 };
    })
    .filter((e) => e.count > 0);

  const allMapped: StalledRow[] = rows.map((r) => ({
    id: r.id_deal,
    cliente: r.nome_negocio?.trim() || "—",
    ativador: r.agente_ativacao?.trim() || "—",
    etapa: r.etapa_negocio?.trim() || "—",
    dias: slaReal(r),
  }));

  const criticos = allMapped
    .filter((r) => r.dias > SLA_PRAZO)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 8);

  const mrrByDeal = new Map<number, number>();
  rows.forEach((r) => mrrByDeal.set(r.id_deal, toNum(r.mrr)));
  const topMrrTravado = rows
    .filter((r) => slaReal(r) > TRAVADO_DIAS)
    .map((r) => ({
      id: r.id_deal,
      cliente: r.nome_negocio?.trim() || "—",
      ativador: r.agente_ativacao?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      dias: slaReal(r),
      mrr: mrrByDeal.get(r.id_deal) ?? 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5);
  const operadores = buildOperadores(rows);

  return { atencao, criticos, topMrrTravado, operadores };
}

export type PeriodKey = "tudo" | "hoje" | "semana" | "mes";

export function filterByPeriod(rows: DashRow[], period: PeriodKey): DashRow[] {
  if (period === "tudo") return rows;
  const now = new Date();
  let start: Date;
  if (period === "hoje") start = startOfDay(now);
  else if (period === "semana") start = startOfWeek(now);
  else start = startOfMonth(now);
  return rows.filter((r) => {
    const d = parseDate(r.data_criacao);
    return d && d >= start;
  });
}

export interface SlaKpis {
  total: number;
  slaP75: number;
  slaMedio: number;
  noPrazo: number;
  noPrazoCount: number;
  estourado: number;
  estouradoCount: number;
}

/** KPIs de SLA por DATA DE CRIAÇÃO (não por etapa). */
export interface SlaCriacaoKpis {
  total: number;
  p75: number;
  media: number;
  pctAcima30: number;
  pctAbaixo30: number;
  countAcima30: number;
  countAbaixo30: number;
}

export function computeSlaCriacaoKpis(rows: DashRow[]): SlaCriacaoKpis {
  const total = rows.length;
  const dias = rows.map((r) => slaReal(r));
  const media = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const p75 = percentile(dias, 0.75);
  const countAcima30 = dias.filter((d) => d > 30).length;
  const countAbaixo30 = total - countAcima30;
  const pctAcima30 = total ? (countAcima30 / total) * 100 : 0;
  const pctAbaixo30 = total ? (countAbaixo30 / total) * 100 : 0;
  return { total, p75, media, pctAcima30, pctAbaixo30, countAcima30, countAbaixo30 };
}

/** Conta deals criados HOJE (data_criacao no dia corrente). */
export function countNovosHoje(rows: DashRow[]): number {
  const start = startOfDay(new Date());
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return rows.filter((r) => {
    const d = parseDate(r.data_criacao);
    return d && d >= start && d < end;
  }).length;
}

/** Soma de MRR e contagem de clientes ativados no período (com data_ativacao no intervalo). */
export function mrrAtivadoNoPeriodo(rows: DashRow[], start: Date, end: Date) {
  const filtered = rows.filter((r) => {
    const d = parseActivationDate(r.data_ativacao);
    return d && d >= start && d < end;
  });
  const mrr = filtered.reduce((s, r) => s + toNum(r.mrr), 0);
  return { count: filtered.length, mrr };
}

/** Conta clientes "entrados" (data_criacao no intervalo). */
export function countEntradosNoPeriodo(rows: DashRow[], start: Date, end: Date) {
  return rows.filter((r) => {
    const d = parseDate(r.data_criacao);
    return d && d >= start && d < end;
  }).length;
}

export function getPeriodRanges() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = startOfWeek(now);
  const nextWeek = new Date(weekStart); nextWeek.setDate(nextWeek.getDate() + 7);
  const monthStart = startOfMonth(now);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  return { todayStart, tomorrow, weekStart, nextWeek, monthStart, nextMonth, lastMonthStart };
}

export interface PeriodSummary {
  novos: number;
  ativados: number;
  mrrTotal: number;
  mrrAtivado: number;
  pctAtivado: number;
}

/** Resumo executivo (novos, ativados, MRR) calculado sobre o conjunto já filtrado por período. */
export function computePeriodSummary(rows: DashRow[]): PeriodSummary {
  const novos = rows.length;
  const ativadosRows = rows.filter((r) => r.etapa_negocio?.trim() === ETAPA_ATIVADO);
  const ativados = ativadosRows.length;
  const mrrTotal = rows.reduce((s, r) => s + toNum(r.mrr), 0);
  const mrrAtivado = ativadosRows.reduce((s, r) => s + toNum(r.mrr), 0);
  const pctAtivado = mrrTotal > 0 ? (mrrAtivado / mrrTotal) * 100 : 0;
  return { novos, ativados, mrrTotal, mrrAtivado, pctAtivado };
}

export function computeSlaKpis(rows: DashRow[]): SlaKpis {
  const total = rows.length;
  const dias = rows.map((r) => slaReal(r));
  const diasCriacao = rows.map((r) => toNum(r.sla_dias_criacao));
  const slaMedio = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const slaP75 = percentile(diasCriacao, 0.75);
  const noPrazoCount = rows.filter((r) => slaReal(r) <= SLA_PRAZO).length;
  const estouradoCount = total - noPrazoCount;
  const noPrazo = total ? (noPrazoCount / total) * 100 : 0;
  const estourado = total ? (estouradoCount / total) * 100 : 0;
  return { total, slaP75, slaMedio, noPrazo, noPrazoCount, estourado, estouradoCount };
}

function aggregate(rows: DashRow[]): DashData {
  const total = rows.length;
  const mrrTotal = rows.reduce((s, r) => s + toNum(r.mrr), 0);
  const dias = rows.map((r) => slaReal(r));
  const tempoMedioFase = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const travados = rows.filter((r) => slaReal(r) > TRAVADO_DIAS).length;

  // SLA
  const slaMedio = tempoMedioFase;
  const slaP75 = percentile(rows.map((r) => toNum(r.sla_dias_criacao)), 0.75);
  const noPrazoCount = rows.filter((r) => slaReal(r) <= SLA_PRAZO).length;
  const estouradoCount = total - noPrazoCount;
  const noPrazo = total ? (noPrazoCount / total) * 100 : 0;
  const estourado = total ? (estouradoCount / total) * 100 : 0;

  // Períodos
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = startOfWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const monthStart = startOfMonth(now);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  const hoje = periodStat(rows, todayStart, tomorrow);
  const semana = periodStat(rows, weekStart, nextWeek);
  const mes = periodStat(rows, monthStart, nextMonth);
  const mesAnterior = periodStat(rows, lastMonthStart, monthStart);

  // Perfis (extrai primeira "palavra" do campo)
  const perfilOrder = ["P", "M", "G", "GG"];
  const perfilMap = new Map<string, number>();
  for (const r of rows) {
    const raw = r.perfil_cliente?.trim() || "";
    const key = raw.split(/\s+/)[0]?.toUpperCase() || "—";
    perfilMap.set(key, (perfilMap.get(key) ?? 0) + 1);
  }
  const perfis: PerfilStat[] = perfilOrder
    .filter((k) => perfilMap.has(k))
    .map((k) => ({
      perfil: k,
      count: perfilMap.get(k)!,
      pct: total ? (perfilMap.get(k)! / total) * 100 : 0,
    }));
  // adiciona perfis fora da ordem padrão
  for (const [k, v] of perfilMap.entries()) {
    if (!perfilOrder.includes(k)) {
      perfis.push({ perfil: k, count: v, pct: total ? (v / total) * 100 : 0 });
    }
  }

  // Por etapa
  const etapaMap = new Map<string, { count: number; mrr: number }>();
  for (const r of rows) {
    const k = r.etapa_negocio?.trim() || "Sem etapa";
    const cur = etapaMap.get(k) ?? { count: 0, mrr: 0 };
    cur.count += 1;
    cur.mrr += toNum(r.mrr);
    etapaMap.set(k, cur);
  }
  const porEtapa = [...etapaMap.entries()]
    .map(([etapa, v]) => ({ etapa, ...v }))
    .sort((a, b) => b.count - a.count);

  // Operadores
  const operadores = buildOperadores(rows);

  const allMapped: StalledRow[] = rows.map((r) => ({
    id: r.id_deal,
    cliente: r.nome_negocio?.trim() || "—",
    ativador: r.agente_ativacao?.trim() || "—",
    etapa: r.etapa_negocio?.trim() || "—",
    dias: slaReal(r),
  }));

  const travadosLista = allMapped
    .filter((r) => r.dias > TRAVADO_DIAS)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  // Pontos de atenção (etapas problemáticas)
  const atencaoEtapas: { etapa: string; tone: "danger" | "warning" }[] = [
    { etapa: "Pré-Cancelamento", tone: "danger" },
    { etapa: "Inativo", tone: "danger" },
    { etapa: "Pendências", tone: "warning" },
    { etapa: "Processo Pausado", tone: "warning" },
  ];
  const atencao = atencaoEtapas
    .map(({ etapa, tone }) => {
      const v = etapaMap.get(etapa);
      return { etapa, tone, count: v?.count ?? 0, mrr: v?.mrr ?? 0 };
    })
    .filter((e) => e.count > 0);

  // SLA crítico (>30 dias na fase) — top 8
  const criticos = allMapped
    .filter((r) => r.dias > SLA_PRAZO)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 8);

  // Top MRR travado/atrasado
  const mrrByDeal = new Map<number, number>();
  rows.forEach((r) => mrrByDeal.set(r.id_deal, toNum(r.mrr)));
  const topMrrTravado = rows
    .filter((r) => slaReal(r) > TRAVADO_DIAS)
    .map((r) => ({
      id: r.id_deal,
      cliente: r.nome_negocio?.trim() || "—",
      ativador: r.agente_ativacao?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      dias: slaReal(r),
      mrr: mrrByDeal.get(r.id_deal) ?? 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5);

  return {
    rows, total, mrrTotal, tempoMedioFase, travados,
    slaMedio, slaP75, noPrazo, noPrazoCount, estourado, estouradoCount,
    hoje, semana, mes, mesAnterior,
    perfis,
    atencao, criticos, topMrrTravado,
    porEtapa, operadores, travadosLista,
  };
}

export function useDashOperacoes() {
  return useQuery({
    queryKey: ["dash_operacoes"],
    queryFn: async (): Promise<DashData> => {
      // PostgREST normalmente entrega até 1000 por requisição, mas algumas
      // configurações limitam a 100. Pedimos páginas grandes mas paginamos
      // pelo tamanho REAL do lote recebido — assim funciona em ambos os casos.
      const PAGE = 1000;
      const HARD_CAP = 100_000;
      const all: DashRow[] = [];
      const { count, error: countError } = await supabase
        .from("dash_operacoes")
        .select("id_deal", { count: "exact", head: true });
      if (countError) throw countError;
      const totalRows = count ?? 0;
      let from = 0;
      while (from < HARD_CAP) {
        const { data, error } = await supabase
          .from("dash_operacoes")
          .select("*")
          .order("id_deal", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as unknown as DashRow[];
        if (!batch.length) break;
        all.push(...batch);
        // Avança pelo tamanho real do lote (cobre o caso da API capar em 100).
        from += batch.length;
        // Critérios de parada: lote menor que o pedido OU já cobrimos o total conhecido.
        if (batch.length < PAGE) break;
        if (totalRows && all.length >= totalRows) break;
      }
      const agg = aggregate(all);
      return { ...agg, totalDb: totalRows };
    },
    refetchInterval: 60_000,
  });
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtBRLk = (n: number) => fmtBRL(n);
export const fmtDias = (n: number) => `${n.toFixed(1)}d`;
export const fmtPct = (n: number, dec = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
