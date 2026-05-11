import { Sparkles, TrendingDown, AlertOctagon, Users } from "lucide-react";
import { fmtBRL, type DashRow, type OperatorStat } from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
  operadores: OperatorStat[];
}

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias_etapa ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const perfilOf = (r: DashRow) =>
  (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();

interface HighlightCard {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Sparkles;
  tone: "danger" | "warning" | "primary" | "neutral";
}

const TONE: Record<HighlightCard["tone"], string> = {
  danger: "border-destructive/40 bg-destructive/[0.06] text-destructive",
  warning: "border-warning/40 bg-warning/[0.06] text-warning",
  primary: "border-primary/40 bg-primary/[0.06] text-primary",
  neutral: "border-border bg-card text-foreground",
};

export const Highlights = ({ rows, operadores }: Props) => {
  if (!rows.length) return null;

  // Operador com mais críticos
  const topCritico = [...operadores].sort((a, b) => b.bands.critico - a.bands.critico)[0];

  // Etapa com maior MRR travado (>7d)
  const etapaMrr = new Map<string, number>();
  for (const r of rows) {
    if (slaOf(r) <= 7) continue;
    const k = r.etapa_negocio?.trim() || "Sem etapa";
    const m = parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;
    etapaMrr.set(k, (etapaMrr.get(k) ?? 0) + m);
  }
  const topEtapa = [...etapaMrr.entries()].sort((a, b) => b[1] - a[1])[0];

  // Perfil com pior SLA médio (>= 3 deals)
  const perfilAgg = new Map<string, { soma: number; n: number }>();
  for (const r of rows) {
    const p = perfilOf(r);
    const cur = perfilAgg.get(p) ?? { soma: 0, n: 0 };
    cur.soma += slaOf(r);
    cur.n += 1;
    perfilAgg.set(p, cur);
  }
  const piorPerfil = [...perfilAgg.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([p, v]) => ({ p, sla: v.soma / v.n, n: v.n }))
    .sort((a, b) => b.sla - a.sla)[0];

  // Total time
  const totalAtivos = rows.length;

  const cards: HighlightCard[] = [];
  if (topCritico && topCritico.bands.critico > 0) {
    cards.push({
      label: "Operador com mais críticos",
      value: topCritico.nome,
      hint: `${topCritico.bands.critico} deals >30d · ${fmtBRL(topCritico.bandsMrr.critico)} em risco`,
      Icon: AlertOctagon,
      tone: "danger",
    });
  }
  if (topEtapa && topEtapa[1] > 0) {
    cards.push({
      label: "Etapa com maior MRR travado",
      value: topEtapa[0],
      hint: `${fmtBRL(topEtapa[1])} parados há mais de 7 dias`,
      Icon: TrendingDown,
      tone: "warning",
    });
  }
  if (piorPerfil) {
    cards.push({
      label: "Perfil com pior SLA",
      value: piorPerfil.p,
      hint: `SLA médio ${piorPerfil.sla.toFixed(1)}d em ${piorPerfil.n} deals`,
      Icon: Users,
      tone: "primary",
    });
  }
  cards.push({
    label: "Carteira ativa",
    value: totalAtivos.toLocaleString("pt-BR"),
    hint: `${operadores.length} ativadores responsáveis`,
    Icon: Sparkles,
    tone: "neutral",
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md-soft ${TONE[c.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-subtitle text-[11px] uppercase tracking-widest opacity-80">
                {c.label}
              </p>
              <p className="mt-1 truncate font-display text-lg font-bold">{c.value}</p>
              <p className="mt-1 font-small text-xs opacity-80">{c.hint}</p>
            </div>
            <c.Icon className="h-5 w-5 shrink-0 opacity-90" />
          </div>
        </div>
      ))}
    </div>
  );
};
