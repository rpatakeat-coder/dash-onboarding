import { AlertTriangle, CheckCircle2, Clock, Store } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { OperatorsTable } from "@/components/dashboard/OperatorsTable";
import { StalledTable } from "@/components/dashboard/StalledTable";

const Index = () => {
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

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Em onboarding"
            value={49}
            icon={Store}
            tone="primary"
            delta={{ value: 12 }}
            hint="Restaurantes ativos no funil"
          />
          <KpiCard
            label="Tempo médio"
            value="17d"
            icon={Clock}
            tone="secondary"
            delta={{ value: -8 }}
            hint="Cadastro até go-live"
          />
          <KpiCard
            label="Concluídos no mês"
            value={28}
            icon={CheckCircle2}
            tone="success"
            delta={{ value: 22 }}
            hint="Restaurantes que foram ao ar"
          />
          <KpiCard
            label="Travados"
            value={5}
            icon={AlertTriangle}
            tone="warning"
            delta={{ value: 25 }}
            hint="Sem evolução há +10 dias"
          />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2"><FunnelChart /></div>
          <div className="lg:col-span-3"><OperatorsTable /></div>
        </section>

        <section className="mb-8">
          <StalledTable />
        </section>

        <footer className="pt-4 text-center font-small text-xs text-muted-foreground">
          Takeat · Painel interno do time de Operações
        </footer>
      </main>
    </div>
  );
};

export default Index;
