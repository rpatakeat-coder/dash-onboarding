import { useMemo } from "react";
import { Flame, ExternalLink } from "lucide-react";
import { computeRisk } from "@/lib/risk";
import { fmtBRL, slaBand, SLA_BAND_META, type DashRow } from "@/hooks/useDashOperacoes";
import { useDealDrawer } from "@/contexts/DealDrawer";

interface Props {
  rows: DashRow[];
  limit?: number;
  variant?: "table" | "vertical";
}

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias_etapa ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const mrrOf = (r: DashRow) =>
  parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;

const BAND_TONE = {
  alto: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-warning/15 text-warning border-warning/30",
  baixo: "bg-success/15 text-success border-success/30",
};

export const RiskRanking = ({ rows, limit = 10, variant = "table" }: Props) => {
  const top = useMemo(() => computeRisk(rows).slice(0, limit), [rows, limit]);
  const { open } = useDealDrawer();

  if (variant === "vertical") {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Top {limit} risco de churn
          </h3>
          <span className="ml-auto font-small text-[10px] text-muted-foreground">
            dias × etapa × perfil × MRR
          </span>
        </div>
        <ol className="flex-1 space-y-2 overflow-y-auto pr-1">
          {top.map((it, i) => {
            const meta = SLA_BAND_META[slaBand(slaOf(it.row))];
            return (
              <li
                key={it.row.id_deal}
                onClick={() => open(it.row)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <span className="font-numeric text-xs font-semibold text-muted-foreground w-5 text-right">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {it.row.nome_negocio?.trim() || "—"}
                  </p>
                  <p className="truncate font-small text-[11px] text-muted-foreground">
                    {(it.row.agente_ativacao?.trim() || "—")} · {(it.row.etapa_negocio?.trim() || "—")}
                  </p>
                </div>
                <div className="flex flex-col items-end leading-tight">
                  <span
                    className="font-numeric text-sm font-semibold tabular-nums"
                    style={{ color: `hsl(var(${meta.cssVar}))` }}
                  >
                    {slaOf(it.row).toFixed(0)}d
                  </span>
                  <span className="font-numeric text-[11px] tabular-nums text-muted-foreground">
                    {fmtBRL(mrrOf(it.row))}
                  </span>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-numeric text-[11px] font-semibold tabular-nums ${BAND_TONE[it.band]}`}
                >
                  {it.score.toFixed(0)}
                </span>
              </li>
            );
          })}
          {!top.length && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Sem dados.
            </li>
          )}
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-destructive" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Top {limit} risco de churn
        </h3>
        <span className="ml-auto font-small text-[10px] text-muted-foreground">
          dias × etapa × perfil × MRR
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto rounded-lg border border-border sm:mx-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/40">
            <tr className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Ativador</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2 text-right">SLA</th>
              <th className="px-3 py-2 text-right">MRR</th>
              <th className="px-3 py-2 text-right">Risco</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {top.map((it, i) => {
              const meta = SLA_BAND_META[slaBand(slaOf(it.row))];
              return (
                <tr
                  key={it.row.id_deal}
                  onClick={() => open(it.row)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-numeric text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {it.row.nome_negocio?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {it.row.agente_ativacao?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {it.row.etapa_negocio?.trim() || "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-numeric font-semibold tabular-nums"
                    style={{ color: `hsl(var(${meta.cssVar}))` }}
                  >
                    {slaOf(it.row).toFixed(0)}d
                  </td>
                  <td className="px-3 py-2 text-right font-numeric tabular-nums">
                    {fmtBRL(mrrOf(it.row))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-numeric text-[11px] font-semibold tabular-nums ${BAND_TONE[it.band]}`}
                    >
                      {it.score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`https://app.hubspot.com/contacts/_/deal/${it.row.id_deal}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {!top.length && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sem dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
