import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiDelta } from "@/hooks/useSnapshotDeltas";

interface Props {
  delta: KpiDelta;
  /** Unidade do valor absoluto (ex.: "d", "%", ""). */
  unit?: string;
  /** Casas decimais do valor absoluto. */
  decimals?: number;
  /** "up" = subir é bom (verde); "down" = descer é bom (verde). */
  goodDirection?: "up" | "down";
  /** Rótulo da janela (ex.: "vs 7d antes"). */
  windowLabel: string;
}

export const KpiDeltaBadge = ({
  delta,
  unit = "",
  decimals = 1,
  goodDirection = "up",
  windowLabel,
}: Props) => {
  if (delta.abs === null) {
    return (
      <div className="mt-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 font-numeric text-[11px] font-medium text-muted-foreground">
          <Minus className="h-3 w-3" />—
        </span>
        <span className="font-small text-[11px] text-muted-foreground">{windowLabel}</span>
      </div>
    );
  }
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
    <div className="mt-3 flex items-center gap-1.5">
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
