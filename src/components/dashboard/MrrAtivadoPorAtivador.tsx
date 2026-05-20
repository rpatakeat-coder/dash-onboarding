import { useMemo, useState } from "react";
import { CalendarIcon, Users, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fmtBRL,
  fmtBRLk,
  mrrAtivadoNoPeriodo,
  getPeriodRanges,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
}

type PeriodKey = "hoje" | "semana" | "mes" | "mes_ant" | "tudo";

const SEM_RESP = "Sem responsável";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "mes_ant", label: "Mês ant." },
  { key: "tudo", label: "Tudo" },
];

export const MrrAtivadoPorAtivador = ({ rows }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [range, setRange] = useState<DateRange | undefined>();

  const { start, end, label } = useMemo(() => {
    if (range?.from) {
      const s = new Date(range.from); s.setHours(0, 0, 0, 0);
      const eBase = range.to ?? range.from;
      const e = new Date(eBase); e.setHours(0, 0, 0, 0); e.setDate(e.getDate() + 1);
      const lbl = range.to
        ? `${format(range.from, "dd/MM/yy", { locale: ptBR })} – ${format(range.to, "dd/MM/yy", { locale: ptBR })}`
        : format(range.from, "dd/MM/yy", { locale: ptBR });
      return { start: s, end: e, label: lbl };
    }
    const r = getPeriodRanges();
    switch (period) {
      case "hoje":
        return { start: r.todayStart, end: r.tomorrow, label: "Hoje" };
      case "semana":
        return { start: r.weekStart, end: r.nextWeek, label: "Esta semana" };
      case "mes":
        return { start: r.monthStart, end: r.nextMonth, label: "Mês atual" };
      case "mes_ant":
        return { start: r.lastMonthStart, end: r.monthStart, label: "Mês anterior" };
      case "tudo":
      default:
        return { start: new Date(0), end: new Date(8640000000000000), label: "Tudo" };
    }
  }, [period, range]);

  const { lista, totalMrr, totalCount } = useMemo(() => {
    const map = new Map<string, { mrr: number; count: number }>();
    for (const r of rows) {
      const k = r.agente_ativacao?.trim() || SEM_RESP;
      if (!map.has(k)) map.set(k, { mrr: 0, count: 0 });
    }
    for (const [nome] of map) {
      const subset = rows.filter((r) => (r.agente_ativacao?.trim() || SEM_RESP) === nome);
      const { mrr, count } = mrrAtivadoNoPeriodo(subset, start, end);
      map.set(nome, { mrr, count });
    }
    const lista = [...map.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.mrr - a.mrr);
    const totalMrr = lista.reduce((s, x) => s + x.mrr, 0);
    const totalCount = lista.reduce((s, x) => s + x.count, 0);
    return { lista, totalMrr, totalCount };
  }, [rows, start, end]);

  const chartHeight = Math.max(180, lista.length * 36 + 20);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-secondary">
            MRR Ativado por ativador
            <InfoTooltip text="Soma do MRR dos deals com data_ativacao dentro do período, agrupado por agente de ativação. Use os filtros de período (incluindo intervalo personalizado) para comparar performance." />
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {label} · {fmtBRL(totalMrr)} · {totalCount} ativação{totalCount === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm-soft">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPeriod(p.key); setRange(undefined); }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 font-subtitle text-xs font-semibold transition",
                  period === p.key && !range?.from
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 rounded-xl font-subtitle text-xs",
                  range?.from && "border-primary/50 bg-primary/5 text-primary",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {range?.from ? (
                  range.to ? (
                    <>
                      {format(range.from, "dd/MM/yy", { locale: ptBR })} – {format(range.to, "dd/MM/yy", { locale: ptBR })}
                    </>
                  ) : (
                    format(range.from, "dd/MM/yy", { locale: ptBR })
                  )
                ) : (
                  "Personalizado"
                )}
                {range?.from && (
                  <X
                    className="ml-1 h-3 w-3 opacity-70 hover:opacity-100"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRange(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => setRange(r)}
                numberOfMonths={2}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Users className="h-5 w-5 shrink-0 text-primary/70" />
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="font-small text-sm text-muted-foreground">
          Nenhuma ativação no período selecionado.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lista}
              layout="vertical"
              margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={150}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) => {
                  const count = (item?.payload as { count: number } | undefined)?.count ?? 0;
                  return [`${fmtBRL(value)} · ${count} ativ.`, "MRR Ativado"];
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="mrr"
                  position="right"
                  formatter={(v: number) => fmtBRLk(v)}
                  style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
