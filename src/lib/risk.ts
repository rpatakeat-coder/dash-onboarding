import type { DashRow } from "@/hooks/useDashOperacoes";

const PESO_ETAPA: Record<string, number> = {
  "Pré-Cancelamento": 5,
  Inativo: 4,
  Pendências: 3,
  "Processo Pausado": 3,
  Treinamento: 1.2,
  Configuração: 1.2,
  Acompanhamento: 0.6,
};

const PESO_PERFIL: Record<string, number> = {
  GG: 2.5,
  G: 2,
  M: 1.3,
  P: 1,
};

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const perfilOf = (r: DashRow) =>
  (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();
const mrrOf = (r: DashRow) =>
  parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;

export interface RiskItem {
  row: DashRow;
  score: number;
  band: "alto" | "medio" | "baixo";
}

export function computeRisk(rows: DashRow[]): RiskItem[] {
  return rows
    .map((row) => {
      const sla = slaOf(row);
      const etapa = row.etapa_negocio?.trim() || "";
      const pe = PESO_ETAPA[etapa] ?? 1;
      const pp = PESO_PERFIL[perfilOf(row)] ?? 1;
      const mrrFactor = 1 + Math.log10(1 + mrrOf(row)) / 4;
      const score = sla * pe * pp * mrrFactor;
      const band: RiskItem["band"] =
        score >= 80 ? "alto" : score >= 30 ? "medio" : "baixo";
      return { row, score, band };
    })
    .sort((a, b) => b.score - a.score);
}
