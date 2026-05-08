import { AlertTriangle, Clock, DollarSign, Store } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { OperatorsTable } from "@/components/dashboard/OperatorsTable";
import { StalledTable } from "@/components/dashboard/StalledTable";
import { useDashOperacoes, fmtBRL, fmtDias } from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, isLoading, error } = useDashOperacoes();

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

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Em onboarding"
            value={isLoading ? "…" : data?.total ?? 0}
            icon={Store}
            tone="primary"
            hint="Restaurantes ativos no funil"
          />
          <KpiCard
            label="MRR no funil"
            value={isLoading ? "…" : fmtBRL(data?.mrrTotal ?? 0)}
            icon={DollarSign}
            tone="secondary"
            hint="Receita recorrente em ativação"
          />
          <KpiCard
            label="Tempo médio na fase"
            value={isLoading ? "…" : fmtDias(data?.tempoMedioFase ?? 0)}
            icon={Clock}
            tone="success"
            hint="Dias na etapa atual"
          />
          <KpiCard
            label="Travados"
            value={isLoading ? "…" : data?.travados ?? 0}
            icon={AlertTriangle}
            tone="warning"
            hint="Mais de 7 dias parados"
          />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <FunnelChart data={data?.porEtapa ?? []} total={data?.total ?? 0} />
          </div>
          <div className="lg:col-span-3">
            <OperatorsTable operadores={data?.operadores ?? []} />
          </div>
        </section>

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
