import { cn } from "@/lib/utils";
import { fmtPct } from "@/hooks/useDashOperacoes";
import type { SnapshotDeltas, DeltaWindow } from "@/hooks/useSnapshotDeltas";
import { KpiDeltaBadge } from "./KpiDeltaBadge";
import type { KpiDelta, DateRange } from "@/hooks/useSnapshotDeltas";

interface Props {
  total: number;
  slaP75: number;
  slaMedio: number;
  noPrazo: number;
  noPrazoCount: number;
  estourado: number;
  estouradoCount: number;
  onEstoqueClick?: () => void;
  deltas?: SnapshotDeltas;
  deltasLoading?: boolean;
  windowDays?: DeltaWindow;
  onChangeWindow?: (w: DeltaWindow) => void;
}

const Card = ({
  label,
  value,
  unit,
  hint,
  tone,
  onClick,
  delta,
  deltaUnit,
  deltaDecimals,
  goodDirection,
  windowLabel,
  showDelta,
  deltaLoading,
  currentRange,
  previousRange,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone?: "default" | "success" | "danger" | "warning";
  onClick?: () => void;
  delta?: KpiDelta;
  deltaUnit?: string;
  deltaDecimals?: number;
  goodDirection?: "up" | "down";
  windowLabel?: string;
  showDelta?: boolean;
  deltaLoading?: boolean;
  currentRange?: DateRange;
  previousRange?: DateRange;
}) => {
  const ring = {
    default: "border-border",
    success: "border-success/40 ring-1 ring-success/20",
    danger: "border-destructive/40 ring-1 ring-destructive/20",
    warning: "border-warning/40 ring-1 ring-warning/20",
  } as const;
  const valueColor = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-destructive",
    warning: "text-warning",
  } as const;
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm-soft transition",
        ring[tone ?? "default"],
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-numeric text-4xl font-bold leading-none", valueColor[tone ?? "default"])}>
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-3 font-small text-xs text-muted-foreground">
        {hint}
        {interactive && <span className="ml-1 text-primary">→ ver detalhes</span>}
      </p>
      {showDelta && windowLabel && (
        <KpiDeltaBadge
          delta={delta}
          unit={deltaUnit}
          decimals={deltaDecimals}
          goodDirection={goodDirection}
          windowLabel={windowLabel}
          loading={deltaLoading}
          currentRange={currentRange}
          previousRange={previousRange}
        />
      )}
    </div>
  );
};

export const SlaKpiRow = ({
  total, slaP75, slaMedio, noPrazo, noPrazoCount, estourado, estouradoCount, onEstoqueClick,
  deltas, deltasLoading, windowDays = 7, onChangeWindow,
}: Props) => {
  const windowLabel = `vs ${windowDays}d antes`;
  return (
    <section className="space-y-3">
      {onChangeWindow && (
        <div className="flex items-center justify-end gap-2 pdf-hide">
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Comparar com
          </span>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {([7, 30] as DeltaWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => onChangeWindow(w)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-subtitle text-xs font-medium transition",
                  windowDays === w
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w}d vs {w}d
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card
          label="Estoque total"
          value={total.toLocaleString("pt-BR")}
          hint="clientes em onboarding"
          onClick={onEstoqueClick}
          delta={deltas?.total}
          deltaUnit=""
          deltaDecimals={0}
          goodDirection="down"
          windowLabel={windowLabel}
          showDelta
          deltaLoading={deltasLoading}
        />
        <Card
          label="P75 SLA"
          value={Math.round(slaP75).toString()}
          unit="dias"
          hint="75% dos clientes"
          tone="warning"
        />
        <Card
          label="SLA médio"
          value={Math.round(slaMedio).toString()}
          unit="dias"
          hint="média do estoque"
          delta={deltas?.slaMedio}
          deltaUnit="d"
          deltaDecimals={1}
          goodDirection="down"
          windowLabel={windowLabel}
          showDelta
          deltaLoading={deltasLoading}
        />
        <Card
          label="% no prazo (≤30d)"
          value={fmtPct(noPrazo)}
          hint={`${noPrazoCount} clientes`}
          tone="success"
          delta={deltas?.noPrazo}
          deltaUnit="pp"
          deltaDecimals={1}
          goodDirection="up"
          windowLabel={windowLabel}
          showDelta
          deltaLoading={deltasLoading}
        />
        <Card
          label="SLA estourado (>30d)"
          value={fmtPct(estourado)}
          hint={`${estouradoCount} clientes — ação`}
          tone="danger"
          delta={deltas?.estourado}
          deltaUnit="pp"
          deltaDecimals={1}
          goodDirection="down"
          windowLabel={windowLabel}
          showDelta
          deltaLoading={deltasLoading}
        />
      </div>
    </section>
  );
};
