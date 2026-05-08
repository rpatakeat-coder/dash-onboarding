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
}

const Card = ({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone?: "default" | "success" | "danger" | "warning";
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
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm-soft", ring[tone ?? "default"])}>
      <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-numeric text-4xl font-bold leading-none", valueColor[tone ?? "default"])}>
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-3 font-small text-xs text-muted-foreground">{hint}</p>
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
