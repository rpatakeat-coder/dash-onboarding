import { TrendingUp, TrendingDown, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import {
  fmtBRLk,
  fmtPct,
  getPeriodRanges,
  mrrAtivadoNoPeriodo,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const MrrAtivadoKpis = ({ rows }: Props) => {
  const r = getPeriodRanges();
  const mrrTotalEstoque = rows.reduce((s, x) => s + num(x.mrr), 0);

  const hoje = mrrAtivadoNoPeriodo(rows, r.todayStart, r.tomorrow);
  const semana = mrrAtivadoNoPeriodo(rows, r.weekStart, r.nextWeek);
  const mes = mrrAtivadoNoPeriodo(rows, r.monthStart, r.nextMonth);
  const mesAnt = mrrAtivadoNoPeriodo(rows, r.lastMonthStart, r.monthStart);

  const pct = (v: number) => (mrrTotalEstoque > 0 ? (v / mrrTotalEstoque) * 100 : 0);

  const pctHoje = pct(hoje.mrr);
  const pctSemana = pct(semana.mrr);
  const pctMes = pct(mes.mrr);
  const pctMesAnt = pct(mesAnt.mrr);

  const deltaMrr = mesAnt.mrr > 0 ? ((mes.mrr - mesAnt.mrr) / mesAnt.mrr) * 100 : mes.mrr > 0 ? 100 : 0;
  const deltaPp = pctMes - pctMesAnt;

  const cards = [
    {
      key: "hoje",
      label: "% MRR Ativado · Hoje",
      icon: Calendar,
      pct: pctHoje,
      mrr: hoje.mrr,
      count: hoje.count,
      accent: "text-primary",
      border: "border-primary/30",
      bg: "bg-primary/[0.04]",
      sub: `${fmtBRLk(hoje.mrr)} · ${hoje.count} ativ.`,
      formula: "Soma do MRR dos deals ativados hoje (data_ativacao = hoje) ÷ MRR total do estoque filtrado × 100.",
    },
    {
      key: "semana",
      label: "% MRR Ativado · Semana",
      icon: CalendarDays,
      pct: pctSemana,
      mrr: semana.mrr,
      count: semana.count,
      accent: "text-foreground",
      border: "border-border",
      bg: "bg-card",
      sub: `${fmtBRLk(semana.mrr)} · ${semana.count} ativ.`,
      formula: "Soma do MRR dos deals ativados nesta semana (segunda → domingo) ÷ MRR total do estoque filtrado × 100.",
    },
    {
      key: "mes",
      label: "% MRR Ativado · Mês atual",
      icon: CalendarRange,
      pct: pctMes,
      mrr: mes.mrr,
      count: mes.count,
      accent: "text-success",
      border: "border-success/30",
      bg: "bg-success/[0.04]",
      sub: `${fmtBRLk(mes.mrr)} · ${mes.count} ativ.`,
      formula: "Soma do MRR dos deals ativados no mês atual ÷ MRR total do estoque filtrado × 100.",
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            % MRR Ativado
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Percentual do MRR do estoque que foi ativado no período
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className={cn("relative rounded-xl border p-4", c.border, c.bg)}>
              <div className="flex items-start justify-between">
                <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
                <div className="flex items-center gap-1.5">
                  <InfoTooltip text={c.formula} />
                  <Icon className={cn("h-4 w-4 opacity-70", c.accent)} />
                </div>
              </div>
              <p className={cn("mt-2 font-numeric text-3xl font-bold", c.accent)}>
                {fmtPct(c.pct, 1)}
              </p>
              <p className="mt-1 font-small text-xs text-muted-foreground">{c.sub}</p>
            </div>
          );
        })}

        {/* Mês atual vs anterior */}
        <div className="relative rounded-xl border border-secondary/30 bg-secondary/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Mês atual vs. anterior
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Variação % do MRR ativado: ((MRR ativado mês atual − MRR ativado mês anterior) ÷ MRR mês anterior) × 100. O p.p. ao lado é a diferença em pontos percentuais do % MRR Ativado entre os dois meses." />
              {deltaMrr >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success/80" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive/80" />
              )}
            </div>
          </div>
          <p
            className={cn(
              "mt-2 font-numeric text-3xl font-bold",
              deltaMrr >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {deltaMrr >= 0 ? "+" : ""}
            {deltaMrr.toFixed(0)}%
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {fmtBRLk(mes.mrr)} vs {fmtBRLk(mesAnt.mrr)} ·{" "}
            <span className={deltaPp >= 0 ? "text-success" : "text-destructive"}>
              {deltaPp >= 0 ? "↑" : "↓"} {Math.abs(deltaPp).toFixed(1)} p.p.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
};
