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

export interface DashData {
  rows: DashRow[];
  total: number;
  mrrTotal: number;
  tempoMedioFase: number;
  travados: number;
  porEtapa: { etapa: string; count: number; mrr: number }[];
  operadores: OperatorStat[];
  travadosLista: StalledRow[];
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const TRAVADO_DIAS = 7;

function aggregate(rows: DashRow[]): DashData {
  const total = rows.length;
  const mrrTotal = rows.reduce((s, r) => s + toNum(r.mrr), 0);
  const dias = rows.map((r) => toNum(r.sla_dias));
  const tempoMedioFase =
    dias.length > 0 ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const travados = rows.filter((r) => toNum(r.sla_dias) > TRAVADO_DIAS).length;

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

  // Por operador
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
  const operadores: OperatorStat[] = [...opMap.entries()]
    .map(([nome, v]) => ({
      nome,
      ativos: v.ativos,
      mrr: v.mrr,
      tempoMedio: v.ativos ? v.soma / v.ativos : 0,
      travados: v.travados,
    }))
    .sort((a, b) => b.ativos - a.ativos);

  // Travados (lista)
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

  return { rows, total, mrrTotal, tempoMedioFase, travados, porEtapa, operadores, travadosLista };
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
export const fmtDias = (n: number) => `${n.toFixed(1)}d`;
