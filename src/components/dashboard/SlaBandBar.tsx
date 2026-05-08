import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SLA_BAND_META, type SlaBand } from "@/hooks/useDashOperacoes";

interface Props {
  bands: Record<SlaBand, number>;
  height?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

const ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];

const HEIGHTS = {
  sm: "h-2",
  md: "h-3",
  lg: "h-5",
} as const;

export const SlaBandBar = ({ bands, height = "sm", showLabels = false, className }: Props) => {
  const total = ORDER.reduce((s, k) => s + (bands[k] ?? 0), 0);
  return (
    <TooltipProvider delayDuration={120}>
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "flex w-full overflow-hidden rounded-full bg-muted",
            HEIGHTS[height],
          )}
        >
          {total === 0 ? (
            <div className="h-full w-full" />
          ) : (
            ORDER.map((k) => {
              const v = bands[k] ?? 0;
              if (v === 0) return null;
              const pct = (v / total) * 100;
              const meta = SLA_BAND_META[k];
              return (
                <Tooltip key={k}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full transition-all hover:opacity-80"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: `hsl(var(${meta.cssVar}))`,
                      }}
                      aria-label={`${meta.label}: ${v}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-subtitle text-xs font-semibold">
                      {meta.label} <span className="text-muted-foreground">({meta.range})</span>
                    </p>
                    <p className="font-numeric text-[11px]">
                      {v} cliente{v === 1 ? "" : "s"} · {pct.toFixed(0)}%
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>

        {showLabels && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {ORDER.map((k) => {
              const meta = SLA_BAND_META[k];
              const v = bands[k] ?? 0;
              return (
                <span key={k} className="flex items-center gap-1.5 font-small text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: `hsl(var(${meta.cssVar}))` }}
                  />
                  <span className="text-muted-foreground">{meta.label}</span>
                  <span className="font-numeric font-bold text-foreground">{v}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
