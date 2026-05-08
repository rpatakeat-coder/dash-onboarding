import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { OperatorsTable } from "@/components/dashboard/OperatorsTable";
import { StalledTable } from "@/components/dashboard/StalledTable";
import { SlaKpiRow } from "@/components/dashboard/SlaKpiRow";
import { PeriodGrids } from "@/components/dashboard/PeriodGrids";
import { AttentionPoints } from "@/components/dashboard/AttentionPoints";
import { SlaCritico } from "@/components/dashboard/SlaCritico";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { useDashOperacoes } from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, error } = useDashOperacoes();
  const [estoqueOpen, setEstoqueOpen] = useState(false);

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
          <div className="mb-8">
            <AttentionPoints atencao={data.atencao} topMrrTravado={data.topMrrTravado} />
          </div>
        )}

        {/* Funil + SLA crítico */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FunnelChart data={data?.porEtapa ?? []} total={data?.total ?? 0} />
          <SlaCritico criticos={data?.criticos ?? []} />
        </section>

        {/* Performance por ativador */}
        <section className="mb-8">
          <OperatorsTable operadores={data?.operadores ?? []} />
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
