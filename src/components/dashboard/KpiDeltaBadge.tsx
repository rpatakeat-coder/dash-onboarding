import { TrendingDown, TrendingUp, Minus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiDelta, DateRange } from "@/hooks/useSnapshotDeltas";

interface Props {
  delta?: KpiDelta;
  unit?: string;
  decimals?: number;
  goodDirection?: "up" | "down";
  windowLabel: string;
  loading?: boolean;
  currentRange?: DateRange;
  previousRange?: DateRange;
}

const fmtBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const buildTooltip = (
  current?: DateRange,
  previous?: DateRange,
  curDays?: number,
  prevDays?: number,
) => {
  if (!current || !previous) return undefined;
  const cur = `Atual: ${fmtBR(current.start)} – ${fmtBR(current.end)}${
    curDays !== undefined ? ` (${curDays}d com dados)` : ""
  }`;
  const prv = `Anterior: ${fmtBR(previous.start)} – ${fmtBR(previous.end)}${
    prevDays !== undefined ? ` (${prevDays}d com dados)` : ""
  }`;
  return `${cur}\n${prv}`;
};

const Skeleton = ({ windowLabel }: { windowLabel: string }) => (
  <div className="mt-3 flex items-center gap-1.5">
    <span className="inline-block h-[18px] w-20 animate-pulse rounded-full bg-muted/60" />
    <span className="font-small text-[11px] text-muted-foreground/70">{windowLabel}</span>
  </div>
);

const NoHistory = ({
  windowLabel,
  tooltip,
}: {
  windowLabel: string;
  tooltip?: string;
}) => (
  <div
    className="mt-3 flex items-center gap-1.5"
    title={
      tooltip
        ? `Sem snapshots suficientes para comparar.\n${tooltip}`
        : "Sem snapshots suficientes para comparar este período. O histórico é coletado diariamente."
    }
  >
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/30 px-2 py-0.5 font-numeric text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" />
      sem histórico
    </span>
    <span className="font-small text-[11px] text-muted-foreground">{windowLabel}</span>
  </div>
);

export const KpiDeltaBadge = ({
  delta,
  unit = "",
  decimals = 1,
  goodDirection = "up",
  windowLabel,
  loading = false,
  currentRange,
  previousRange,
}: Props) => {
  if (loading) return <Skeleton windowLabel={windowLabel} />;

  const tooltip = buildTooltip(
    currentRange,
    previousRange,
    delta?.currentDays,
    delta?.previousDays,
  );

  if (!delta || delta.abs === null)
    return <NoHistory windowLabel={windowLabel} tooltip={tooltip} />;

  const isFlat = Math.abs(delta.abs) < 0.05;
  const isUp = delta.abs > 0;
  const isGood = isFlat ? null : (isUp ? goodDirection === "up" : goodDirection === "down");
  const tone =
    isGood === null
      ? "bg-muted/40 text-muted-foreground"
      : isGood
      ? "bg-success/10 text-success"
      : "bg-destructive/10 text-destructive";
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const sign = isUp ? "+" : "";
  const absStr = `${sign}${delta.abs.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${unit}`;
  const pctStr =
    delta.pct !== null
      ? ` (${isUp ? "+" : ""}${delta.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`
      : "";
  return (
    <div className="mt-3 flex items-center gap-1.5" title={tooltip}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-numeric text-[11px] font-semibold",
          tone,
        )}
      >
        <Icon className="h-3 w-3" />
        {absStr}
        {pctStr}
      </span>
      <span className="font-small text-[11px] text-muted-foreground">{windowLabel}</span>
    </div>
  );
};
