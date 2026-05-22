import { useMemo } from "react";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { cn } from "@/lib/utils";
import type { DashRow } from "@/hooks/useDashOperacoes";

export type MacroPeriodKey = "tudo" | "hoje" | "semana" | "mes" | "trimestre";

const PERIODS: { key: MacroPeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
];

interface Props {
  rows: DashRow[];
  ativadores: Set<string>;
  etapas: Set<string>;
  onAtivadoresChange: (next: Set<string>) => void;
  onEtapasChange: (next: Set<string>) => void;
  hideAtivador?: boolean;
  periodo?: MacroPeriodKey;
  onPeriodoChange?: (next: MacroPeriodKey) => void;
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
}: Props) => {
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

  const hasAny = ativadores.size + etapas.size > 0 || periodo !== "tudo";

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
              onClick={() => onPeriodoChange(p.key)}
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
        </div>
      )}
      {hasAny && (
        <button
          onClick={() => {
            onAtivadoresChange(new Set());
            onEtapasChange(new Set());
            onPeriodoChange?.("tudo");
          }}
          className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
};
