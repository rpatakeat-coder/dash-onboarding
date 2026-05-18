import { TrendingDown, ShieldAlert } from "lucide-react";
import { computeChurnKpis, fmtBRL, type DashRow } from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";

interface Props {
  /** Base completa (todas as rows) — o filtro de etapa/mês é feito aqui dentro. */
  rows: DashRow[];
  className?: string;
}

export const ChurnKpis = ({ rows, className }: Props) => {
  const k = computeChurnKpis(rows);
  const mesLabel = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const dentroMeta = k.churnReal <= k.churnMaximo;
  const pctClamped = Math.min(100, Math.max(0, k.pctDoMaximo));

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Churn · {mesLabel}
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Pré-Churn + Churn (Sucesso) + Cancelamento (Onboarding) — fechados no mês
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-subtitle text-[11px] font-semibold",
            dentroMeta
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {dentroMeta ? "Dentro da meta" : "Acima da meta"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Churn Máximo */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center gap-2 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Churn máximo (meta)
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            {fmtBRL(k.churnMaximo)}
          </p>
          <p className="font-small text-xs text-muted-foreground">
            9% × {fmtBRL(k.mrrCriadoMes)} de MRR criado no mês
          </p>
        </div>

        {/* Churn Real */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center gap-2 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            Churn real
          </div>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-bold tabular-nums",
              dentroMeta ? "text-foreground" : "text-destructive",
            )}
          >
            {fmtBRL(k.churnReal)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-small text-xs text-muted-foreground">
              {k.churnRealCount} deal{k.churnRealCount === 1 ? "" : "s"} fechado
              {k.churnRealCount === 1 ? "" : "s"}
            </span>
            <span
              className={cn(
                "font-numeric text-xs font-semibold tabular-nums",
                dentroMeta ? "text-success" : "text-destructive",
              )}
            >
              {k.pctDoMaximo.toFixed(1)}% do máximo
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                dentroMeta ? "bg-success" : "bg-destructive",
              )}
              style={{ width: `${pctClamped}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
