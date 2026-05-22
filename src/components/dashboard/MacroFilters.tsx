import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DashRow } from "@/hooks/useDashOperacoes";

export type MacroPeriodKey = "tudo" | "hoje" | "semana" | "mes" | "trimestre" | "custom";

const PERIODS: { key: MacroPeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
];

export interface CustomRange {
  start: Date;
  end: Date;
}

interface Props {
  rows: DashRow[];
  ativadores: Set<string>;
  etapas: Set<string>;
  onAtivadoresChange: (next: Set<string>) => void;
  onEtapasChange: (next: Set<string>) => void;
  hideAtivador?: boolean;
  periodo?: MacroPeriodKey;
  onPeriodoChange?: (next: MacroPeriodKey) => void;
  customRange?: CustomRange | null;
  onCustomRangeChange?: (next: CustomRange | null) => void;
}

export const MacroFilters = ({
  rows,
  ativadores,
  etapas,
  onAtivadoresChange,
  onEtapasChange,
  hideAtivador,
  periodo = "tudo",
  onPeriodoChange,
  customRange,
  onCustomRangeChange,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    customRange ? { from: customRange.start, to: customRange.end } : undefined,
  );

  const { ativadorOpts, etapaOpts, ativadorCounts, etapaCounts } = useMemo(() => {
    const a = new Map<string, number>();
    const e = new Map<string, number>();
    for (const r of rows) {
      const ka = r.agente_ativacao?.trim() || "Sem responsável";
      const ke = r.etapa_negocio?.trim() || "Sem etapa";
      a.set(ka, (a.get(ka) ?? 0) + 1);
      if (!/^\d+$/.test(ke)) {
        e.set(ke, (e.get(ke) ?? 0) + 1);
      }
    }
    return {
      ativadorOpts: [...a.keys()],
      etapaOpts: [...e.keys()],
      ativadorCounts: Object.fromEntries(a),
      etapaCounts: Object.fromEntries(e),
    };
  }, [rows]);

  const hasAny =
    ativadores.size + etapas.size > 0 || periodo !== "tudo" || !!customRange;

  const customLabel =
    periodo === "custom" && customRange
      ? `${format(customRange.start, "dd/MM/yy", { locale: ptBR })} – ${format(
          new Date(customRange.end.getTime() - 1),
          "dd/MM/yy",
          { locale: ptBR },
        )}`
      : "Personalizado";

  const applyCustom = () => {
    if (draft?.from && draft?.to && onCustomRangeChange && onPeriodoChange) {
      const start = new Date(draft.from); start.setHours(0, 0, 0, 0);
      const end = new Date(draft.to); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
      onCustomRangeChange({ start, end });
      onPeriodoChange("custom");
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
        Filtrar KPIs:
      </span>
      {!hideAtivador && (
        <MultiSelectFilter
          label="Ativador"
          options={ativadorOpts}
          selected={ativadores}
          onChange={onAtivadoresChange}
          counts={ativadorCounts}
        />
      )}
      <MultiSelectFilter
        label="Ocultar fase"
        options={etapaOpts}
        selected={etapas}
        onChange={onEtapasChange}
        counts={etapaCounts}
      />
      {onPeriodoChange && (
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                onPeriodoChange(p.key);
                if (p.key !== "custom") onCustomRangeChange?.(null);
              }}
              className={cn(
                "rounded px-2 py-1 font-subtitle text-[11px] font-semibold transition",
                periodo === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          {onCustomRangeChange && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 font-subtitle text-[11px] font-semibold transition",
                    periodo === "custom"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {customLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={draft}
                  onSelect={setDraft}
                  numberOfMonths={2}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                <div className="flex items-center justify-end gap-2 border-t border-border p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(undefined);
                      onCustomRangeChange(null);
                      onPeriodoChange("tudo");
                      setOpen(false);
                    }}
                    className="rounded px-2 py-1 font-subtitle text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={applyCustom}
                    disabled={!draft?.from || !draft?.to}
                    className="rounded bg-primary px-2 py-1 font-subtitle text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
      {hasAny && (
        <button
          onClick={() => {
            onAtivadoresChange(new Set());
            onEtapasChange(new Set());
            onPeriodoChange?.("tudo");
            onCustomRangeChange?.(null);
            setDraft(undefined);
          }}
          className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
};
