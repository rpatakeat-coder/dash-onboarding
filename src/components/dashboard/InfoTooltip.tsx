import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  className?: string;
}

/**
 * Small info icon with tooltip. Use to clarify which underlying field
 * a KPI / chart consumes (sla_dias_etapa vs sla_dias_criacao).
 */
export const InfoTooltip = ({ text, className }: Props) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label="Mais informações"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
      {text}
    </TooltipContent>
  </Tooltip>
);
