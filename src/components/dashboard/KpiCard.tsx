import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; suffix?: string };
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "success" | "warning";
  hint?: string;
}


const toneMap = {
  primary: "text-primary bg-primary/10",
  secondary: "text-secondary bg-secondary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
} as const;

export const KpiCard = ({ label, value, delta, icon: Icon, tone = "primary", hint }: KpiCardProps) => {
  const isUp = (delta?.value ?? 0) >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 font-numeric text-4xl font-bold text-foreground">
            {value}
          </p>
          {hint && (
            <p className="mt-1 font-small text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
      {delta && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-numeric text-xs font-semibold",
            isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isUp ? "+" : ""}{delta.value}{delta.suffix ?? "%"}
          </span>
          <span className="font-small text-xs text-muted-foreground">vs. mês anterior</span>
        </div>
      )}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-primary opacity-0 blur-3xl transition-opacity group-hover:opacity-20" />
    </div>
  );
};
