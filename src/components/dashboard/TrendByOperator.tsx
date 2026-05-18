import { useMemo } from "react";
import { ArrowRight, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseActivationDate, type DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  onSelectOperator?: (name: string) => void;
}

const WEEKS = 8;

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
};

interface Row {
  nome: string;
  series: number[];
  total: number;
  last: number;
  prevAvg: number;
  delta: number; // %
}

export const TrendByOperator = ({ rows, onSelectOperator }: Props) => {
  const data = useMemo<Row[]>(() => {
    const thisWeek = startOfWeek(new Date());
    const buckets: Date[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const d = new Date(thisWeek);
      d.setDate(d.getDate() - i * 7);
      buckets.push(d);
    }
    const map = new Map<string, number[]>();
    for (const r of rows) {
      const da = parseActivationDate(r.data_ativacao);
      if (!da) continue;
      const w = startOfWeek(da).getTime();
      const idx = buckets.findIndex((b) => b.getTime() === w);
      if (idx < 0) continue;
      const k = r.agente_ativacao?.trim() || "Sem responsável";
      let arr = map.get(k);
      if (!arr) {
        arr = new Array(WEEKS).fill(0);
        map.set(k, arr);
      }
      arr[idx] += 1;
    }
    const out: Row[] = [];
    for (const [nome, series] of map) {
      const total = series.reduce((s, n) => s + n, 0);
      if (total === 0) continue;
      const last = series[WEEKS - 1];
      const prev = series.slice(0, WEEKS - 1);
      const prevAvg = prev.reduce((s, n) => s + n, 0) / prev.length;
      const delta = prevAvg > 0 ? ((last - prevAvg) / prevAvg) * 100 : last > 0 ? 100 : 0;
      out.push({ nome, series, total, last, prevAvg, delta });
    }
    // ordem: maior queda primeiro, depois maior total
    out.sort((a, b) => a.delta - b.delta || b.total - a.total);
    return out;
  }, [rows]);

  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap((d) => d.series)),
    [data],
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Tendência semanal de ativações
        </h3>
        <p className="font-small text-xs text-muted-foreground">
          Últimas {WEEKS} semanas por ativador · variação = última semana vs. média das {WEEKS - 1} anteriores
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="pb-2 pl-1 pr-3">Ativador</th>
              <th className="pb-2 pr-3">Últimas {WEEKS} semanas</th>
              <th className="pb-2 pr-3 text-right">Última</th>
              <th className="pb-2 pr-3 text-right">Total</th>
              <th className="pb-2 pr-1 text-right">Variação</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const tone =
                r.delta <= -20
                  ? "text-destructive"
                  : r.delta >= 20
                    ? "text-success"
                    : "text-muted-foreground";
              const Arrow =
                r.delta <= -5 ? ArrowDownRight : r.delta >= 5 ? ArrowUpRight : Minus;
              return (
                <tr
                  key={r.nome}
                  className="group cursor-pointer border-t border-border/60 transition hover:bg-muted/40"
                  onClick={() => onSelectOperator?.(r.nome)}
                >
                  <td className="py-2 pl-1 pr-3 font-subtitle text-sm font-medium text-foreground">
                    {r.nome}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex h-7 items-end gap-[3px]">
                      {r.series.map((v, i) => {
                        const h = (v / maxVal) * 100;
                        const isLast = i === r.series.length - 1;
                        return (
                          <span
                            key={i}
                            className={cn(
                              "w-2 rounded-sm transition",
                              isLast ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                            style={{ height: `${Math.max(h, v > 0 ? 8 : 2)}%` }}
                            title={`Semana -${WEEKS - 1 - i}: ${v}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-numeric text-sm font-semibold tabular-nums text-foreground">
                    {r.last}
                  </td>
                  <td className="py-2 pr-3 text-right font-numeric text-sm tabular-nums text-muted-foreground">
                    {r.total}
                  </td>
                  <td className={cn("py-2 pr-1 text-right font-numeric text-sm font-semibold tabular-nums", tone)}>
                    <span className="inline-flex items-center gap-1">
                      <Arrow className="h-3.5 w-3.5" />
                      {r.delta > 0 ? "+" : ""}
                      {r.delta.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2 pr-1 text-right">
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
