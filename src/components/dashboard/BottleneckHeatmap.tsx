import { useMemo } from "react";
import { Flame } from "lucide-react";
import {
  SLA_BAND_META,
  slaBand,
  type DashRow,
  type SlaBand,
} from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  onCellClick?: (etapa: string, band: SlaBand) => void;
}

const BANDS: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias_etapa ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const BottleneckHeatmap = ({ rows, onCellClick }: Props) => {
  const { etapas, matrix, max } = useMemo(() => {
    const map = new Map<string, Record<SlaBand, number>>();
    for (const r of rows) {
      const k = r.etapa_negocio?.trim() || "Sem etapa";
      const b = slaBand(slaOf(r));
      const cur = map.get(k) ?? { critico: 0, atencao: 0, alerta: 0, saudavel: 0 };
      cur[b] += 1;
      map.set(k, cur);
    }
    const list = [...map.entries()]
      .map(([etapa, counts]) => ({
        etapa,
        counts,
        total: counts.critico + counts.atencao + counts.alerta + counts.saudavel,
        problemas: counts.critico + counts.atencao,
      }))
      .sort((a, b) => b.problemas - a.problemas || b.total - a.total);
    const m = list.reduce(
      (acc, l) => Math.max(acc, l.counts.critico, l.counts.atencao, l.counts.alerta, l.counts.saudavel),
      1,
    );
    return { etapas: list, matrix: list, max: m };
  }, [rows]);

  if (!matrix.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
          <Flame className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Gargalos por etapa
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Quantidade de deals em cada faixa de SLA · clique para abrir o estoque filtrado
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Etapa</th>
              {BANDS.map((b) => (
                <th key={b} className="px-3 py-2 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `hsl(var(${SLA_BAND_META[b].cssVar}))` }}
                    />
                    {SLA_BAND_META[b].label}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {etapas.map((row) => (
              <tr key={row.etapa} className="transition-colors hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">{row.etapa}</td>
                {BANDS.map((b) => {
                  const v = row.counts[b];
                  const intensity = v / max;
                  const color = `hsl(var(${SLA_BAND_META[b].cssVar}))`;
                  return (
                    <td key={b} className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!v}
                        onClick={() => onCellClick?.(row.etapa, b)}
                        className="mx-auto flex h-10 w-full max-w-[88px] items-center justify-center rounded-md font-numeric text-sm font-bold tabular-nums transition hover:scale-[1.04] disabled:cursor-default disabled:opacity-40"
                        style={{
                          backgroundColor: v
                            ? `${color.replace("hsl(", "hsla(").replace(")", `, ${0.12 + intensity * 0.55})`)}`
                            : "transparent",
                          color: v ? color : "hsl(var(--muted-foreground))",
                          border: v ? `1px solid ${color.replace("hsl(", "hsla(").replace(")", ", 0.4)")}` : "1px dashed hsl(var(--border))",
                        }}
                        title={`${row.etapa} · ${SLA_BAND_META[b].label}: ${v} deals`}
                      >
                        {v || "—"}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-numeric font-semibold tabular-nums text-foreground">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
