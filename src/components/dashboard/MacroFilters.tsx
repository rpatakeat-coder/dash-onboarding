import { useMemo } from "react";
import { MultiSelectFilter } from "./MultiSelectFilter";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  ativadores: Set<string>;
  etapas: Set<string>;
  onAtivadoresChange: (next: Set<string>) => void;
  onEtapasChange: (next: Set<string>) => void;
  hideAtivador?: boolean;
}

export const MacroFilters = ({
  rows,
  ativadores,
  etapas,
  onAtivadoresChange,
  onEtapasChange,
  hideAtivador,
}: Props) => {
  const { ativadorOpts, etapaOpts, ativadorCounts, etapaCounts } = useMemo(() => {
    const a = new Map<string, number>();
    const e = new Map<string, number>();
    for (const r of rows) {
      const ka = r.agente_ativacao?.trim() || "Sem responsável";
      const ke = r.etapa_negocio?.trim() || "Sem etapa";
      a.set(ka, (a.get(ka) ?? 0) + 1);
      // Oculta nas opções de filtro etapas que vieram apenas como ID numérico
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

  const hasAny = ativadores.size + etapas.size > 0;

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
      {hasAny && (
        <button
          onClick={() => {
            onAtivadoresChange(new Set());
            onEtapasChange(new Set());
          }}
          className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
};
