import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MacroEstoque } from "@/components/dashboard/MacroEstoque";
import { MacroMovimento } from "@/components/dashboard/MacroMovimento";
import { MrrAtivadoKpis } from "@/components/dashboard/MrrAtivadoKpis";
import { MrrAtivadoTrendChart } from "@/components/dashboard/MrrAtivadoTrendChart";
import { MacroFilters } from "@/components/dashboard/MacroFilters";
import { CarteiraPorAtivador } from "@/components/dashboard/CarteiraPorAtivador";
import { RankingVariavelAtivadores } from "@/components/dashboard/RankingVariavelAtivadores";
import { DealsTable } from "@/components/dashboard/DealsTable";
import { RefreshDataButton } from "@/components/dashboard/RefreshDataButton";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { AiInsightsDialog } from "@/components/dashboard/AiInsightsDialog";
import { ManagerialView } from "@/components/dashboard/ManagerialView";
import { GestaoAlerts } from "@/components/dashboard/GestaoAlerts";
import { TrendByOperator } from "@/components/dashboard/TrendByOperator";
import { ChurnKpis } from "@/components/dashboard/ChurnKpis";
import { useAtivadorScope } from "@/hooks/useAtivadorScope";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import { useDashOperacoes, type PerfilStat } from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, isLoading, error } = useDashOperacoes();
  const { isAdmin, isAtivador, myAgente } = useAtivadorScope();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const isGestao = tab === "gestao" && isAdmin;
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [filtroAtivadores, setFiltroAtivadores] = usePersistedSet("index:ativadores");
  const [filtroEtapas, setFiltroEtapas] = usePersistedSet("index:etapas");
  const [gestaoOp, setGestaoOp] = useState<string | null>(null);

  const focusOperator = (name: string) => {
    setGestaoOp(name);
    setTimeout(() => {
      document.getElementById("gestao-managerial")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const allRows = data?.rows ?? [];

  const isSucessoPipeline = (r: { pipeline_nome: string | null }) =>
    (r.pipeline_nome?.trim().toLowerCase() ?? "") === "sucesso";

  const personalRows = (() => {
    if (isAdmin || !isAtivador) return allRows;
    const me = myAgente.toLowerCase();
    return allRows.filter(
      (r) => (r.agente_ativacao?.trim().toLowerCase() ?? "") === me,
    );
  })();

  // Os filtros (ativador/etapa) só listam e contam deals do pipeline "Onboarding".
  // A regra do MRR Ativado (Visão Geral) não é afetada — ela continua usando macroRows.
  const isOnboardingPipeline = (r: { pipeline_nome: string | null }) =>
    (r.pipeline_nome?.trim().toLowerCase() ?? "") === "onboarding";
  const filtersBase = personalRows.filter(isOnboardingPipeline);

  // Macros respeitam o escopo do usuário (RLS já garante, mas reforçamos)
  // e os filtros locais de ativador/etapa.
  const macroBase = personalRows;
  const macroRows = useMemo(() => {
    return macroBase.filter((r) => {
      if (filtroAtivadores.size > 0) {
        const a = r.agente_ativacao?.trim() || "Sem responsável";
        if (!filtroAtivadores.has(a)) return false;
      }
      if (filtroEtapas.size > 0) {
        const e = r.etapa_negocio?.trim() || "Sem etapa";
        if (filtroEtapas.has(e)) return false;
      }
      return true;
    });
  }, [macroBase, filtroAtivadores, filtroEtapas]);

  // Estoque atual: todos os deals atualmente no pipeline "Onboarding".
  const estoqueRows = useMemo(() => {
    return macroRows.filter(
      (r) => (r.pipeline_nome?.trim().toLowerCase() ?? "") === "onboarding",
    );
  }, [macroRows]);

  // Recalcula distribuição de perfis em cima do estoque (Onboarding · mês atual)
  const perfisFiltrados: PerfilStat[] = useMemo(() => {
    const order = ["P", "M", "G", "GG"];
    const map = new Map<string, number>();
    for (const r of estoqueRows) {
      const k = r.perfil_cliente?.trim().split(/\s+/)[0]?.toUpperCase() || "—";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const total = estoqueRows.length;
    const out: PerfilStat[] = order
      .filter((k) => map.has(k))
      .map((k) => ({ perfil: k, count: map.get(k)!, pct: total ? (map.get(k)! / total) * 100 : 0 }));
    for (const [k, v] of map.entries()) {
      if (!order.includes(k)) {
        out.push({ perfil: k, count: v, pct: total ? (v / total) * 100 : 0 });
      }
    }
    return out;
  }, [estoqueRows]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <DashboardHeader />

      <main className="mx-auto max-w-[1400px] space-y-6 px-3 py-6 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div data-tour="filters" className="flex-1 min-w-0">
            <MacroFilters
              rows={filtersBase}
              ativadores={filtroAtivadores}
              etapas={filtroEtapas}
              onAtivadoresChange={setFiltroAtivadores}
              onEtapasChange={setFiltroEtapas}
              hideAtivador={isAtivador && !isAdmin}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-tour="ai-insights"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 font-subtitle text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Insights de IA
            </button>
            <RefreshDataButton />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 font-subtitle text-sm text-destructive">
            Erro ao carregar dados: {(error as Error).message}
          </div>
        )}
        {isLoading && !data && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center font-subtitle text-sm text-muted-foreground">
            Carregando…
          </div>
        )}

        {data && isGestao && (() => {
          // Gestão oculta clientes do pipeline "Sucesso" (a regra de MRR Ativado não é afetada — ela vive na Visão Geral).
          const gestaoMacro = macroRows.filter((r) => !isSucessoPipeline(r));
          const gestaoPersonal = personalRows.filter((r) => !isSucessoPipeline(r));
          return (
            <>
              <GestaoAlerts rows={gestaoMacro} onSelectOperator={focusOperator} />
              <ChurnKpis rows={personalRows} />
              <TrendByOperator rows={gestaoMacro} onSelectOperator={focusOperator} />
              <ManagerialView
                rows={gestaoMacro}
                totalRows={gestaoPersonal.length}
                selectedOperator={gestaoOp}
                onSelectOperator={setGestaoOp}
              />
            </>
          );
        })()}

        {data && !isGestao && (
          <>
            <MacroEstoque
              rows={estoqueRows}
              perfis={perfisFiltrados}
              onTotalClick={() => setEstoqueOpen(true)}
            />

            <div data-tour="kpis">
              <MrrAtivadoKpis rows={macroRows} />
            </div>

            <ChurnKpis rows={personalRows} />

            <MrrAtivadoTrendChart rows={macroRows} />

            <MacroMovimento rows={macroRows} />

            <CarteiraPorAtivador rows={estoqueRows} />

            <RankingVariavelAtivadores
              rows={allRows}
              onlyAgente={isAdmin ? null : (isAtivador ? myAgente : null)}
            />

            <div data-tour="deals">
              <DealsTable
                rows={personalRows}
                hideAtivadorFilter={isAtivador && !isAdmin}
              />
            </div>
          </>
        )}
      </main>

      <EstoqueModal
        open={estoqueOpen}
        onOpenChange={setEstoqueOpen}
        rows={estoqueRows}
      />

      <AiInsightsDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        rows={macroRows}
        filtroAtivadores={filtroAtivadores}
        filtroEtapas={filtroEtapas}
      />
    </div>
  );
};

export default Index;
