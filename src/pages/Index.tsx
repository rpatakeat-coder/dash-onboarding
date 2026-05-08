import { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { OperatorsTable } from "@/components/dashboard/OperatorsTable";
import { StalledTable } from "@/components/dashboard/StalledTable";
import { SlaKpiRow } from "@/components/dashboard/SlaKpiRow";
import { PeriodGrids } from "@/components/dashboard/PeriodGrids";
import { AttentionPoints } from "@/components/dashboard/AttentionPoints";
import { SlaCritico } from "@/components/dashboard/SlaCritico";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import {
  computeFiltered,
  filterByPeriod,
  useDashOperacoes,
  type DashRow,
  type PeriodKey,
} from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, error } = useDashOperacoes();
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [atencaoPeriod, setAtencaoPeriod] = useState<PeriodKey>("tudo");
  const [criticoPeriod, setCriticoPeriod] = useState<PeriodKey>("tudo");
  const [opPeriod, setOpPeriod] = useState<PeriodKey>("tudo");
  const [ativadorSel, setAtivadorSel] = useState<Set<string>>(new Set());
  const [etapaSel, setEtapaSel] = useState<Set<string>>(new Set());

  const allRows = data?.rows ?? [];

  const ativadoresOpts = useMemo(
    () => [...new Set(allRows.map((r) => r.agente_ativacao?.trim() || "Sem responsável"))],
    [allRows],
  );
  const etapasOpts = useMemo(
    () => [...new Set(allRows.map((r) => r.etapa_negocio?.trim() || "Sem etapa"))],
    [allRows],
  );

  const rows = useMemo<DashRow[]>(
    () =>
      allRows.filter((r) => {
        if (
          ativadorSel.size &&
          !ativadorSel.has(r.agente_ativacao?.trim() || "Sem responsável")
        )
          return false;
        if (etapaSel.size && !etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa"))
          return false;
        return true;
      }),
    [allRows, ativadorSel, etapaSel],
  );

  const atencaoData = useMemo(() => computeFiltered(filterByPeriod(rows, atencaoPeriod)), [rows, atencaoPeriod]);
  const criticoData = useMemo(() => computeFiltered(filterByPeriod(rows, criticoPeriod)), [rows, criticoPeriod]);
  const opData = useMemo(() => computeFiltered(filterByPeriod(rows, opPeriod)), [rows, opPeriod]);

  const countsBy = useMemo(() => {
    const ETAPAS_ATENCAO = new Set(["Pré-Cancelamento", "Inativo", "Pendências", "Processo Pausado"]);
    const periodos: PeriodKey[] = ["tudo", "hoje", "semana", "mes"];
    const make = (predicate: (r: (typeof rows)[number]) => boolean) => {
      const out: Partial<Record<PeriodKey, number>> = {};
      for (const p of periodos) {
        out[p] = filterByPeriod(rows, p).filter(predicate).length;
      }
      return out;
    };
    return {
      atencao: make((r) => ETAPAS_ATENCAO.has(r.etapa_negocio?.trim() || "")),
      critico: make((r) => {
        const n = parseFloat(String(r.sla_dias ?? "").replace(",", "."));
        return Number.isFinite(n) && n > 30;
      }),
      operadores: make(() => true),
    };
  }, [rows]);

  const hasGlobalFilters = ativadorSel.size > 0 || etapaSel.size > 0;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <DashboardHeader />

      <main className="mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
        <div className="mb-8 animate-fade-in-up">
          <h2 className="font-display text-3xl font-bold tracking-tight text-secondary md:text-4xl">
            Visão executiva
          </h2>
          <p className="mt-1 font-subtitle text-sm text-muted-foreground">
            Acompanhe em tempo real o desempenho do time de Onboarding Takeat
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro ao carregar dados: {(error as Error).message}
          </div>
        )}

        {/* SLA / Estoque */}
        <div className="mb-6">
          <SlaKpiRow
            total={data?.total ?? 0}
            slaP75={data?.slaP75 ?? 0}
            slaMedio={data?.slaMedio ?? 0}
            noPrazo={data?.noPrazo ?? 0}
            noPrazoCount={data?.noPrazoCount ?? 0}
            estourado={data?.estourado ?? 0}
            estouradoCount={data?.estouradoCount ?? 0}
            onEstoqueClick={() => setEstoqueOpen(true)}
          />
        </div>

        <EstoqueModal
          open={estoqueOpen}
          onOpenChange={setEstoqueOpen}
          rows={data?.rows ?? []}
        />

        {/* Filtros globais (Ativador + Etapa) */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Filtrar por
          </span>
          <MultiSelectFilter
            label="Ativador"
            options={ativadoresOpts}
            selected={ativadorSel}
            onChange={setAtivadorSel}
          />
          <MultiSelectFilter
            label="Etapa"
            options={etapasOpts}
            selected={etapaSel}
            onChange={setEtapaSel}
          />
          {hasGlobalFilters && (
            <>
              <span className="font-small text-xs text-muted-foreground">
                {rows.length.toLocaleString("pt-BR")} de {allRows.length.toLocaleString("pt-BR")} clientes
              </span>
              <button
                onClick={() => {
                  setAtivadorSel(new Set());
                  setEtapaSel(new Set());
                }}
                className="ml-auto rounded-lg px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-destructive"
              >
                Limpar filtros
              </button>
            </>
          )}
        </div>

        {/* Períodos + Perfis + MRR Ativado */}
        <div className="mb-8">
          {data && (
            <PeriodGrids
              hoje={data.hoje}
              semana={data.semana}
              mes={data.mes}
              mesAnterior={data.mesAnterior}
              perfis={data.perfis}
            />
          )}
        </div>

        {/* Pontos de atenção */}
        {data && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Pontos de atenção
              </h3>
              <PeriodFilter value={atencaoPeriod} onChange={setAtencaoPeriod} counts={countsBy.atencao} />
            </div>
            <AttentionPoints atencao={atencaoData.atencao} topMrrTravado={atencaoData.topMrrTravado} />
          </section>
        )}

        {/* Funil + SLA crítico */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FunnelChart data={data?.porEtapa ?? []} total={data?.total ?? 0} />
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                SLA crítico
              </h3>
              <PeriodFilter value={criticoPeriod} onChange={setCriticoPeriod} counts={countsBy.critico} />
            </div>
            <SlaCritico criticos={criticoData.criticos} />
          </div>
        </section>

        {/* Performance por ativador */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Performance por ativador
            </h3>
            <PeriodFilter value={opPeriod} onChange={setOpPeriod} counts={countsBy.operadores} />
          </div>
          <OperatorsTable operadores={opData.operadores} />
        </section>

        {/* Travados */}
        <section className="mb-8">
          <StalledTable travados={data?.travadosLista ?? []} />
        </section>

        <footer className="pt-4 text-center font-small text-xs text-muted-foreground">
          Takeat · Painel interno do time de Operações
        </footer>
      </main>
    </div>
  );
};

export default Index;
