import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MacroEstoque } from "@/components/dashboard/MacroEstoque";
import { MacroMovimento } from "@/components/dashboard/MacroMovimento";
import { MrrAtivadoKpis } from "@/components/dashboard/MrrAtivadoKpis";
import { MrrAtivadoTrendChart } from "@/components/dashboard/MrrAtivadoTrendChart";
import { MacroFilters } from "@/components/dashboard/MacroFilters";
import { CarteiraPorAtivador } from "@/components/dashboard/CarteiraPorAtivador";
import { DealsTable } from "@/components/dashboard/DealsTable";
import { RefreshDataButton } from "@/components/dashboard/RefreshDataButton";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { AiInsightsDialog } from "@/components/dashboard/AiInsightsDialog";
import { useAtivadorScope } from "@/hooks/useAtivadorScope";
import { useDashOperacoes, type PerfilStat } from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, isLoading, error } = useDashOperacoes();
  const { isAdmin, isAtivador, myAgente } = useAtivadorScope();
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [filtroAtivadores, setFiltroAtivadores] = useState<Set<string>>(new Set());
  const [filtroEtapas, setFiltroEtapas] = useState<Set<string>>(new Set());

  const allRows = data?.rows ?? [];

  const personalRows = (() => {
    if (isAdmin || !isAtivador) return allRows;
    const me = myAgente.toLowerCase();
    return allRows.filter(
      (r) => (r.agente_ativacao?.trim().toLowerCase() ?? "") === me,
    );
  })();

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
              rows={personalRows}
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

        {data && (
          <>
            <MacroEstoque
              rows={estoqueRows}
              perfis={perfisFiltrados}
              onTotalClick={() => setEstoqueOpen(true)}
            />

            <div data-tour="kpis">
              <MrrAtivadoKpis rows={macroRows} />
            </div>

            <MrrAtivadoTrendChart rows={macroRows} />

            <MacroMovimento rows={macroRows} />

            <CarteiraPorAtivador rows={estoqueRows} />

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
