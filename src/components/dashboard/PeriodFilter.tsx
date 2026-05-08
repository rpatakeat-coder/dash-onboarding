import { cn } from "@/lib/utils";
import type { PeriodKey } from "@/hooks/useDashOperacoes";

const OPTS: { key: PeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

interface Props {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
  className?: string;
}

export const PeriodFilter = ({ value, onChange, className }: Props) => {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm-soft",
        className,
      )}
    >
      {OPTS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-subtitle text-xs font-semibold transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
