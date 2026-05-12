import { CalendarDays, Sparkles } from "lucide-react";
import {
  countNovosHoje,
  fmtBRLk,
  getPeriodRanges,
  mrrAtivadoNoPeriodo,
  type DashRow,
} from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
}

export const MacroMovimento = ({ rows }: Props) => {
  const novosHoje = countNovosHoje(rows);
  const r = getPeriodRanges();
  const hoje = mrrAtivadoNoPeriodo(rows, r.todayStart, r.tomorrow);
  const semana = mrrAtivadoNoPeriodo(rows, r.weekStart, r.nextWeek);
  const mes = mrrAtivadoNoPeriodo(rows, r.monthStart, r.nextMonth);
  const mesAnt = mrrAtivadoNoPeriodo(rows, r.lastMonthStart, r.monthStart);

  const cards: { label: string; value: string; sub: string; accent?: string }[] = [
    {
      label: "Hoje",
      value: fmtBRLk(hoje.mrr),
      sub: `${hoje.count} clientes ativados`,
      accent: "text-primary",
    },
    {
      label: "Esta semana",
      value: fmtBRLk(semana.mrr),
      sub: `${semana.count} clientes ativados`,
      accent: "text-foreground",
    },
    {
      label: "Este mês",
      value: fmtBRLk(mes.mrr),
      sub: `${mes.count} clientes ativados`,
      accent: "text-success",
    },
    {
      label: "Mês anterior",
      value: fmtBRLk(mesAnt.mrr),
      sub: `${mesAnt.count} clientes ativados`,
      accent: "text-muted-foreground",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-success/30 bg-success/[0.04] p-5 lg:col-span-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Novos hoje
            </p>
            <p className="mt-2 font-numeric text-4xl font-bold text-success">
              {novosHoje}
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              entradas no funil
            </p>
          </div>
          <Sparkles className="h-6 w-6 text-success/70" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm-soft lg:col-span-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-secondary">
              MRR ativado por período
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Soma de MRR dos clientes que chegaram em "Acompanhamento"
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary/70" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card/60 p-4">
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
