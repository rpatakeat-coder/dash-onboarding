import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashRow {
  id_deal: number;
  nome_negocio: string | null;
  perfil_cliente: string | null;
  mrr: string | null;
  agente_ativacao: string | null;
  sla_dias: string | null;
  data_criacao: string | null;
  data_entrada_fase: string | null;
  etapa_negocio: string | null;
}

export interface OperatorStat {
  nome: string;
  ativos: number;
  mrr: number;
  tempoMedio: number;
  travados: number;
}

export interface StalledRow {
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
}

export interface DashData {
  rows: DashRow[];
  total: number;
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

const parseDate = (s: string | null): Date | null => {
  if (!s) return null;
  // formato "YYYY-MM-DD HH:MM"
  const iso = s.includes("T") ? s : s.replace(" ", "T");
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

function aggregate(rows: DashRow[]): DashData {
  const total = rows.length;
  const mrrTotal = rows.reduce((s, r) => s + toNum(r.mrr), 0);
  const dias = rows.map((r) => toNum(r.sla_dias));
  const tempoMedioFase = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const travados = rows.filter((r) => toNum(r.sla_dias) > TRAVADO_DIAS).length;

  // SLA
  const slaMedio = tempoMedioFase;
  const slaP75 = percentile(dias, 0.75);
  const noPrazoCount = rows.filter((r) => toNum(r.sla_dias) <= SLA_PRAZO).length;
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
  const opMap = new Map<string, { ativos: number; mrr: number; soma: number; travados: number }>();
  for (const r of rows) {
    const k = r.agente_ativacao?.trim() || "Sem responsável";
    const cur = opMap.get(k) ?? { ativos: 0, mrr: 0, soma: 0, travados: 0 };
    const d = toNum(r.sla_dias);
    cur.ativos += 1;
    cur.mrr += toNum(r.mrr);
    cur.soma += d;
    if (d > TRAVADO_DIAS) cur.travados += 1;
    opMap.set(k, cur);
  }
  const operadores = [...opMap.entries()]
    .map(([nome, v]) => ({
      nome,
      ativos: v.ativos,
      mrr: v.mrr,
      tempoMedio: v.ativos ? v.soma / v.ativos : 0,
      travados: v.travados,
    }))
    .sort((a, b) => b.ativos - a.ativos);

  const travadosLista: StalledRow[] = rows
    .map((r) => ({
      cliente: r.nome_negocio?.trim() || "—",
      ativador: r.agente_ativacao?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      dias: toNum(r.sla_dias),
    }))
    .filter((r) => r.dias > TRAVADO_DIAS)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  return {
    rows, total, mrrTotal, tempoMedioFase, travados,
    slaMedio, slaP75, noPrazo, noPrazoCount, estourado, estouradoCount,
    hoje, semana, mes, mesAnterior,
    perfis,
    porEtapa, operadores, travadosLista,
  };
}

export function useDashOperacoes() {
  return useQuery({
    queryKey: ["dash_operacoes"],
    queryFn: async (): Promise<DashData> => {
      const { data, error } = await supabase
        .from("dash_operacoes")
        .select("*")
        .limit(2000);
      if (error) throw error;
      return aggregate((data ?? []) as DashRow[]);
    },
    refetchInterval: 60_000,
  });
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRLk = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return fmtBRL(n);
};
export const fmtDias = (n: number) => `${n.toFixed(1)}d`;
export const fmtPct = (n: number, dec = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
