import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { fmtBRL, fmtBRLk, parseActivationDate, parseDate, type DashRow } from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashRow[];
}

const toNum = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type RangeKey = 6 | 12;

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const MrrAtivadoTrendChart = ({ rows }: Props) => {
  const [range, setRange] = useState<RangeKey>(6);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const data = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; mrr: number; qtd: number; criados: number; pct: number; isCurrent: boolean }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        mrr: 0,
        qtd: 0,
        criados: 0,
        pct: 0,
        isCurrent: i === 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
      for (const row of rows) {
        const d = parseActivationDate(row.data_ativacao);
      if (d) {
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        const i = idx.get(k);
        if (i !== undefined) {
          buckets[i].mrr += toNum(row.mrr);
          buckets[i].qtd += 1;
        }
      }
      const dc = parseDate(row.data_criacao);
      if (dc) {
        const k = `${dc.getFullYear()}-${dc.getMonth()}`;
        const i = idx.get(k);
        if (i !== undefined) buckets[i].criados += 1;
      }
    }
    for (const b of buckets) {
      b.pct = b.criados > 0 ? (b.qtd / b.criados) * 100 : 0;
    }
    return buckets;
  }, [rows, range]);

  const totalMrr = data.reduce((s, b) => s + b.mrr, 0);
  const avgMrr = data.length > 0 ? totalMrr / data.length : 0;
  const maxMrr = Math.max(0, ...data.map((b) => b.mrr));
  const peak = data.find((b) => b.mrr === maxMrr && maxMrr > 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-secondary">
              MRR Ativado · Comparativo mensal
            </h2>
            <InfoTooltip text="Soma do MRR dos deals com data_ativacao em cada mês civil. A linha mostra a quantidade de ativações no período. Mês corrente em destaque." />
          </div>
          <p className="font-small text-xs text-muted-foreground">
            Evolução do MRR ativado nos últimos {range} meses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            {([6, 12] as RangeKey[]).map((r) => {
              const active = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-subtitle text-xs font-semibold transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {r}m
                </button>
              );
            })}
          </div>
          <BarChart3 className="h-5 w-5 text-primary/70" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
            Total no período
          </p>
          <p className="mt-1 font-numeric text-lg font-bold text-foreground">{fmtBRL(totalMrr)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
            Média mensal
          </p>
          <p className="mt-1 font-numeric text-lg font-bold text-foreground">{fmtBRL(avgMrr)}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-card/60 p-3 sm:col-span-1">
          <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
            Pico
          </p>
          <p className="mt-1 font-numeric text-lg font-bold text-success">
            {peak ? `${peak.label} · ${fmtBRLk(peak.mrr)}` : "—"}
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrAtivBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38 60% 78%)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="hsl(38 55% 70%)" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="mrrAtivBarCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142 65% 70%)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="hsl(142 60% 62%)" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmtBRLk(v)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              hide
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontFamily: "Nunito Sans",
              }}
              formatter={(value: number, name) => {
                if (name === "MRR Ativado") return [fmtBRL(value), name];
                if (name === "% Ativação")
                  return [`${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`, name];
                return [value.toLocaleString("pt-BR"), name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
              onClick={(o: any) => toggle(String(o.dataKey))}
              formatter={(value, entry: any) => (
                <span
                  style={{
                    opacity: hidden.has(String(entry?.dataKey)) ? 0.4 : 1,
                    textDecoration: hidden.has(String(entry?.dataKey)) ? "line-through" : "none",
                  }}
                >
                  {value}
                </span>
              )}
            />
            <Bar
              yAxisId="left"
              dataKey="mrr"
              name="MRR Ativado"
              radius={[8, 8, 0, 0]}
              fill="url(#mrrAtivBar)"
              hide={hidden.has("mrr")}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.isCurrent ? "url(#mrrAtivBarCurrent)" : "url(#mrrAtivBar)"}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="qtd"
              name="Ativações"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--chart-3))" }}
              activeDot={{ r: 5 }}
              hide={hidden.has("qtd")}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="pct"
              name="% Ativação"
              stroke="hsl(210 90% 60%)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "hsl(210 90% 60%)" }}
              activeDot={{ r: 5 }}
              hide={hidden.has("pct")}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="criados"
              name="Deals criados"
              stroke="hsl(var(--chart-5))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--chart-5))" }}
              activeDot={{ r: 5 }}
              hide={hidden.has("criados")}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
