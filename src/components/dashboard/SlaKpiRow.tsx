import { cn } from "@/lib/utils";
import { fmtPct } from "@/hooks/useDashOperacoes";

interface Props {
  total: number;
  slaP75: number;
  slaMedio: number;
  noPrazo: number;
  noPrazoCount: number;
  estourado: number;
  estouradoCount: number;
  onEstoqueClick?: () => void;
}

const Card = ({
  label,
  value,
  unit,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone?: "default" | "success" | "danger" | "warning";
  onClick?: () => void;
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
    </div>
  );
};

export const SlaKpiRow = ({
  total, slaP75, slaMedio, noPrazo, noPrazoCount, estourado, estouradoCount,
}: Props) => {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card
        label="Estoque total"
        value={total.toLocaleString("pt-BR")}
        hint="clientes em onboarding"
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
      />
      <Card
        label="% no prazo (≤30d)"
        value={fmtPct(noPrazo)}
        hint={`${noPrazoCount} clientes`}
        tone="success"
      />
      <Card
        label="SLA estourado (>30d)"
        value={fmtPct(estourado)}
        hint={`${estouradoCount} clientes — ação`}
        tone="danger"
      />
    </section>
  );
};
