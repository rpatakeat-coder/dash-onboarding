import { useMemo } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SLA_BAND_META,
  fmtBRL,
  slaBand,
  type DashRow,
  type SlaBand,
} from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
}

const PERFIL_ORDER = ["P", "M", "G", "GG"];
const BANDS: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias_etapa ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const perfilOf = (r: DashRow) =>
  (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();
const mrrOf = (r: DashRow) =>
  parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;

export const PerfilSlaPanel = ({ rows }: Props) => {
  const data = useMemo(() => {
    const map = new Map<
      string,
      { count: number; soma: number; mrr: number; bands: Record<SlaBand, number> }
    >();
    for (const r of rows) {
      const k = perfilOf(r);
      const cur =
        map.get(k) ?? { count: 0, soma: 0, mrr: 0, bands: { critico: 0, atencao: 0, alerta: 0, saudavel: 0 } };
      const d = slaOf(r);
      cur.count += 1;
      cur.soma += d;
      cur.mrr += mrrOf(r);
      cur.bands[slaBand(d)] += 1;
      map.set(k, cur);
    }
    const list = [...map.entries()].map(([perfil, v]) => ({
      perfil,
      count: v.count,
      slaMedio: v.count ? v.soma / v.count : 0,
      mrr: v.mrr,
      bands: v.bands,
      pctCritico: v.count ? (v.bands.critico / v.count) * 100 : 0,
    }));
    return list.sort((a, b) => {
      const ai = PERFIL_ORDER.indexOf(a.perfil);
      const bi = PERFIL_ORDER.indexOf(b.perfil);
      if (ai === -1 && bi === -1) return a.perfil.localeCompare(b.perfil);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rows]);

  if (!data.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            SLA por perfil de cliente
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Distribuição de SLA por porte (P / M / G / GG)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((p) => {
          const total = p.count || 1;
          return (
            <div key={p.perfil} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-2xl font-bold text-foreground">{p.perfil}</p>
                <p className="font-numeric text-sm tabular-nums text-muted-foreground">
                  {p.count} deals
                </p>
              </div>
              <p className="mt-1 font-numeric text-xs tabular-nums text-muted-foreground">
                SLA médio{" "}
                <span className={cn(
                  "font-bold",
                  p.slaMedio > 30 ? "text-destructive" : p.slaMedio > 20 ? "text-warning" : "text-success",
                )}>
                  {p.slaMedio.toFixed(1)}d
                </span>
                {" · "}{fmtBRL(p.mrr)}
              </p>

              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                {BANDS.map((b) => {
                  const pct = (p.bands[b] / total) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={b}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: `hsl(var(${SLA_BAND_META[b].cssVar}))`,
                      }}
                      title={`${SLA_BAND_META[b].label}: ${p.bands[b]}`}
                    />
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {BANDS.map((b) => {
                  const v = p.bands[b];
                  if (!v) return null;
                  const color = `hsl(var(${SLA_BAND_META[b].cssVar}))`;
                  return (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-numeric text-[10px] font-semibold tabular-nums"
                      style={{
                        backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.14)")}`,
                        color,
                      }}
                    >
                      {SLA_BAND_META[b].label.charAt(0)}
                      {v}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
