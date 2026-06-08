import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DashSucessoRow = Database["public"]["Tables"]["dash_sucesso"]["Row"];

export type PerfilGrupo = "P+M" | "G+GG" | "Sem perfil";

const PM = new Set(["P", "M"]);
const GGG = new Set(["G", "GG"]);

export const grupoPerfil = (p: string | null | undefined): PerfilGrupo => {
  const v = (p ?? "").trim().toUpperCase();
  if (PM.has(v)) return "P+M";
  if (GGG.has(v)) return "G+GG";
  return "Sem perfil";
};

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtPct = (n: number, digits = 0) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const fmtNumPct = (n: number, total: number) =>
  total > 0 ? `${n.toLocaleString("pt-BR")} (${fmtPct((n / total) * 100)})` : `${n.toLocaleString("pt-BR")} (0%)`;

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// ---------- Selectors ----------

export interface OverviewStats {
  totalClientes: number;
  qtdPM: number;
  qtdGGG: number;
  qtdSemPerfil: number;
  mrrTotal: number;
  mrrPM: number;
  mrrGGG: number;
  mrrSemPerfil: number;
  pctPM: number;
  pctGGG: number;
  pctSemPerfil: number;
  pctMrrPM: number;
  pctMrrGGG: number;
  pctMrrSemPerfil: number;
}

export const selectOverview = (rows: DashSucessoRow[]): OverviewStats => {
  // Carteira ativa = pipeline Sucesso e não está em Churn.
  const ativos = rows.filter(
    (r) => norm(r.pipeline_nome) === "sucesso" && norm(r.etapa_negocio) !== "churn",
  );
  let qtdPM = 0, qtdGGG = 0, qtdSem = 0;
  let mrrPM = 0, mrrGGG = 0, mrrSem = 0;
  for (const r of ativos) {
    const g = grupoPerfil(r.perfil_cliente);
    const m = num(r.mrr);
    if (g === "P+M") { qtdPM++; mrrPM += m; }
    else if (g === "G+GG") { qtdGGG++; mrrGGG += m; }
    else { qtdSem++; mrrSem += m; }
  }
  const total = ativos.length;
  const mrrTotal = mrrPM + mrrGGG + mrrSem;
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  return {
    totalClientes: total,
    qtdPM, qtdGGG, qtdSemPerfil: qtdSem,
    mrrTotal, mrrPM, mrrGGG, mrrSemPerfil: mrrSem,
    pctPM: pct(qtdPM, total),
    pctGGG: pct(qtdGGG, total),
    pctSemPerfil: pct(qtdSem, total),
    pctMrrPM: pct(mrrPM, mrrTotal),
    pctMrrGGG: pct(mrrGGG, mrrTotal),
    pctMrrSemPerfil: pct(mrrSem, mrrTotal),
  };
};

export interface CarteiraAgente {
  agente: string;
  clientes: number;
  mrr: number;
  qtdPM: number;
  qtdGGG: number;
  qtdSemPerfil: number;
  mrrPM: number;
  mrrGGG: number;
  mrrSemPerfil: number;
  pctCarteira: number;
  pctMrr: number;
}

export const selectCarteira = (rows: DashSucessoRow[]): CarteiraAgente[] => {
  const ativos = rows.filter(
    (r) => norm(r.pipeline_nome) === "sucesso" && norm(r.etapa_negocio) !== "churn",
  );
  const map = new Map<string, CarteiraAgente>();
  for (const r of ativos) {
    const a = r.agente_sucesso?.trim() || "Sem responsável";
    const cur = map.get(a) ?? {
      agente: a, clientes: 0, mrr: 0,
      qtdPM: 0, qtdGGG: 0, qtdSemPerfil: 0,
      mrrPM: 0, mrrGGG: 0, mrrSemPerfil: 0,
      pctCarteira: 0, pctMrr: 0,
    };
    const m = num(r.mrr);
    cur.clientes++;
    cur.mrr += m;
    const g = grupoPerfil(r.perfil_cliente);
    if (g === "P+M") { cur.qtdPM++; cur.mrrPM += m; }
    else if (g === "G+GG") { cur.qtdGGG++; cur.mrrGGG += m; }
    else { cur.qtdSemPerfil++; cur.mrrSemPerfil += m; }
    map.set(a, cur);
  }

  const totalClientes = ativos.length;
  const totalMrr = ativos.reduce((s, r) => s + num(r.mrr), 0);
  return Array.from(map.values())
    .map((c) => ({
      ...c,
      pctCarteira: totalClientes > 0 ? (c.clientes / totalClientes) * 100 : 0,
      pctMrr: totalMrr > 0 ? (c.mrr / totalMrr) * 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);
};

export interface RiscoItem {
  row: DashSucessoRow;
  motivos: string[];
  score: number;
}

const RISCO_ETAPAS: Record<string, number> = {
  "pré-cancelamento": 5,
  "pre-cancelamento": 5,
  "inativo": 4,
  "pendências": 3,
  "pendencias": 3,
  "processo pausado": 3,
};

export const selectRisco = (rows: DashSucessoRow[]): RiscoItem[] => {
  const ativos = rows.filter(
    (r) => norm(r.pipeline_nome) === "sucesso" && norm(r.etapa_negocio) !== "churn",
  );
  const out: RiscoItem[] = [];
  for (const r of ativos) {
    const etapa = norm(r.etapa_negocio);
    const motivos: string[] = [];
    let score = 0;
    const w = RISCO_ETAPAS[etapa];
    if (w) { score += w; motivos.push(`Etapa: ${r.etapa_negocio}`); }
    if (motivos.length) out.push({ row: r, motivos, score });
  }
  return out.sort((a, b) => b.score - a.score);
};

export interface ChurnMes {
  ym: string; // YYYY-MM
  qtd: number;
  mrr: number;
}

export interface ChurnStats {
  totalChurn: number;
  mrrChurn: number;
  porMes: ChurnMes[];
  porMotivo: { motivo: string; qtd: number; mrr: number }[];
}

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const selectChurn = (rows: DashSucessoRow[]): ChurnStats => {
  const churn = rows.filter(
    (r) => norm(r.pipeline_nome) === "sucesso" && norm(r.etapa_negocio) === "churn",
  );
  const porMesMap = new Map<string, ChurnMes>();
  const porMotMap = new Map<string, { motivo: string; qtd: number; mrr: number }>();
  let mrrTotal = 0;
  for (const r of churn) {
    const m = num(r.mrr);
    mrrTotal += m;
    const d = parseDate(r.data_fechamento) ?? parseDate(r.data_entrada_fase);
    if (d) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = porMesMap.get(ym) ?? { ym, qtd: 0, mrr: 0 };
      cur.qtd++; cur.mrr += m;
      porMesMap.set(ym, cur);
    }
    const motivo = r.etapa_de_cancelamento?.trim() || "Sem motivo";
    const cm = porMotMap.get(motivo) ?? { motivo, qtd: 0, mrr: 0 };
    cm.qtd++; cm.mrr += m;
    porMotMap.set(motivo, cm);
  }
  return {
    totalChurn: churn.length,
    mrrChurn: mrrTotal,
    porMes: Array.from(porMesMap.values()).sort((a, b) => a.ym.localeCompare(b.ym)),
    porMotivo: Array.from(porMotMap.values()).sort((a, b) => b.qtd - a.qtd),
  };
};

// ---------- Hook ----------

const fetchDashSucesso = async (): Promise<DashSucessoRow[]> => {
  const pageSize = 1000;
  let from = 0;
  const all: DashSucessoRow[] = [];
  // paginate to avoid 1000-row default cap
  while (true) {
    const { data, error } = await supabase
      .from("dash_sucesso")
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

export interface OverviewView {
  total_clientes: number;
  qtd_pm: number;
  qtd_ggg: number;
  qtd_sem_perfil: number;
  mrr_total: number;
  mrr_pm: number;
  mrr_ggg: number;
  mrr_sem_perfil: number;
}

const fetchOverviewView = async (): Promise<OverviewView | null> => {
  const { data, error } = await (supabase as any)
    .from("vw_sucesso_overview")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    total_clientes: num(data.total_clientes),
    qtd_pm: num(data.qtd_pm),
    qtd_ggg: num(data.qtd_ggg),
    qtd_sem_perfil: num(data.qtd_sem_perfil),
    mrr_total: num(data.mrr_total),
    mrr_pm: num(data.mrr_pm),
    mrr_ggg: num(data.mrr_ggg),
    mrr_sem_perfil: num(data.mrr_sem_perfil),
  };
};

export const useSucessoOverviewView = () =>
  useQuery({
    queryKey: ["vw_sucesso_overview"],
    queryFn: fetchOverviewView,
    staleTime: 1000 * 60 * 5,
  });

export const useDashSucesso = () => {
  const query = useQuery({
    queryKey: ["dash_sucesso"],
    queryFn: fetchDashSucesso,
    staleTime: 1000 * 60 * 5,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const overview = useMemo(() => selectOverview(rows), [rows]);
  const carteira = useMemo(() => selectCarteira(rows), [rows]);
  const risco = useMemo(() => selectRisco(rows), [rows]);
  const churn = useMemo(() => selectChurn(rows), [rows]);

  return {
    ...query,
    rows,
    overview,
    carteira,
    risco,
    churn,
  };
};
