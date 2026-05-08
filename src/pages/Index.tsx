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
import {
  computeFiltered,
  filterByPeriod,
  useDashOperacoes,
  type PeriodKey,
} from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, error } = useDashOperacoes();
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [atencaoPeriod, setAtencaoPeriod] = useState<PeriodKey>("tudo");
  const [criticoPeriod, setCriticoPeriod] = useState<PeriodKey>("tudo");
  const [opPeriod, setOpPeriod] = useState<PeriodKey>("tudo");

  const rows = data?.rows ?? [];
  const atencaoData = useMemo(() => computeFiltered(filterByPeriod(rows, atencaoPeriod)), [rows, atencaoPeriod]);
  const criticoData = useMemo(() => computeFiltered(filterByPeriod(rows, criticoPeriod)), [rows, criticoPeriod]);
  const opData = useMemo(() => computeFiltered(filterByPeriod(rows, opPeriod)), [rows, opPeriod]);

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
              <PeriodFilter value={atencaoPeriod} onChange={setAtencaoPeriod} />
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
              <PeriodFilter value={criticoPeriod} onChange={setCriticoPeriod} />
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
            <PeriodFilter value={opPeriod} onChange={setOpPeriod} />
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
