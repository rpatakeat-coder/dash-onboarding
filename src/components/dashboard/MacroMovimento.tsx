import { CalendarDays, Sparkles } from "lucide-react";
import {
  countNovosHoje,
  countEntradosNoPeriodo,
  fmtBRLk,
  getPeriodRanges,
  mrrAtivadoNoPeriodo,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
}

export const MacroMovimento = ({ rows }: Props) => {
  const novosHoje = countNovosHoje(rows);
  const r = getPeriodRanges();

  const periods = [
    { key: "hoje", label: "Hoje", start: r.todayStart, end: r.tomorrow, accent: "text-primary" },
    { key: "semana", label: "Esta semana", start: r.weekStart, end: r.nextWeek, accent: "text-foreground" },
    { key: "mes", label: "Este mês", start: r.monthStart, end: r.nextMonth, accent: "text-success" },
    { key: "mesAnt", label: "Mês anterior", start: r.lastMonthStart, end: r.monthStart, accent: "text-muted-foreground" },
  ] as const;

  const cards = periods.map((p) => {
    const ativ = mrrAtivadoNoPeriodo(rows, p.start, p.end);
    const entrados = countEntradosNoPeriodo(rows, p.start, p.end);
    return {
      label: p.label,
      value: fmtBRLk(ativ.mrr),
      sub: `${ativ.count} ativados · ${entrados} entrados`,
      accent: p.accent,
      formula: `MRR ativado em ${p.label.toLowerCase()} = soma de mrr dos deals com data_ativacao dentro do período. "Entrados" = deals com data de criação no mesmo período.`,
    };
  });

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="relative rounded-2xl border border-success/30 bg-success/[0.04] p-5 lg:col-span-1">
        <div className="absolute right-2 top-2"><InfoTooltip text="Entradas hoje = contagem de deals cuja data de criação é hoje (00:00 → 23:59), sem aplicar filtros de etapa." /></div>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Entradas hoje
            </p>
            <p className="mt-2 font-numeric text-4xl font-bold text-success">
              {novosHoje}
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              {novosHoje === 1 ? "cliente entrou" : "clientes entraram"} no pipeline hoje
            </p>
          </div>
          <Sparkles className="h-6 w-6 text-success/70" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft lg:col-span-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-secondary">
              MRR ativado por período
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Clientes entrados (data de criação) e ativados (data de ativação) no período
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary/70" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="relative rounded-xl border border-border bg-card/60 p-4">
              <div className="absolute right-2 top-2"><InfoTooltip text={c.formula} /></div>
              <p className="font-subtitle text-xs text-muted-foreground">{c.label}</p>
              <p className={`mt-2 font-numeric text-2xl font-bold ${c.accent ?? ""}`}>
                {c.value}
              </p>
              <p className="mt-1 font-small text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
