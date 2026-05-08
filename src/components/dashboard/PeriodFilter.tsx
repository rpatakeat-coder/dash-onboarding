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
  counts?: Partial<Record<PeriodKey, number>>;
  className?: string;
}

export const PeriodFilter = ({ value, onChange, counts, className }: Props) => {
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
        const count = counts?.[o.key];
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-subtitle text-xs font-semibold transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{o.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-numeric text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground/70",
                )}
              >
                {count.toLocaleString("pt-BR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
