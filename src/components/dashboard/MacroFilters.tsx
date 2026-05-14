import { useMemo } from "react";
import { MultiSelectFilter } from "./MultiSelectFilter";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  ativadores: Set<string>;
  etapas: Set<string>;
  pipelines: Set<string>;
  onAtivadoresChange: (next: Set<string>) => void;
  onEtapasChange: (next: Set<string>) => void;
  onPipelinesChange: (next: Set<string>) => void;
  hideAtivador?: boolean;
}

export const MacroFilters = ({
  rows,
  ativadores,
  etapas,
  pipelines,
  onAtivadoresChange,
  onEtapasChange,
  onPipelinesChange,
  hideAtivador,
}: Props) => {
  const { ativadorOpts, etapaOpts, pipelineOpts, ativadorCounts, etapaCounts, pipelineCounts } = useMemo(() => {
    const a = new Map<string, number>();
    const e = new Map<string, number>();
    const p = new Map<string, number>();
    for (const r of rows) {
      const ka = r.agente_ativacao?.trim() || "Sem responsável";
      const ke = r.etapa_negocio?.trim() || "Sem etapa";
      const kp = r.pipeline_nome?.trim() || "Sem pipeline";
      a.set(ka, (a.get(ka) ?? 0) + 1);
      e.set(ke, (e.get(ke) ?? 0) + 1);
      p.set(kp, (p.get(kp) ?? 0) + 1);
    }
    return {
      ativadorOpts: [...a.keys()],
      etapaOpts: [...e.keys()],
      pipelineOpts: [...p.keys()],
      ativadorCounts: Object.fromEntries(a),
      etapaCounts: Object.fromEntries(e),
      pipelineCounts: Object.fromEntries(p),
    };
  }, [rows]);

  const hasAny = ativadores.size + etapas.size + pipelines.size > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
        Filtrar KPIs:
      </span>
      <MultiSelectFilter
        label="Pipeline"
        options={pipelineOpts}
        selected={pipelines}
        onChange={onPipelinesChange}
        counts={pipelineCounts}
      />
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
        label="Etapa"
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
            onPipelinesChange(new Set());
          }}
          className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
};
