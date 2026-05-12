import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MacroEstoque } from "@/components/dashboard/MacroEstoque";
import { MacroMovimento } from "@/components/dashboard/MacroMovimento";
import { CarteiraPorAtivador } from "@/components/dashboard/CarteiraPorAtivador";
import { DealsTable } from "@/components/dashboard/DealsTable";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { useAtivadorScope } from "@/hooks/useAtivadorScope";
import { useDashOperacoes } from "@/hooks/useDashOperacoes";

const Index = () => {
  const { data, isLoading, error } = useDashOperacoes();
  const { isAdmin, isAtivador, myAgente } = useAtivadorScope();
  const [estoqueOpen, setEstoqueOpen] = useState(false);

  const allRows = data?.rows ?? [];

  // Para ativador não-admin, escopo já vem filtrado por RLS,
  // mas garantimos defensivamente também no client.
  const personalRows = (() => {
    if (isAdmin || !isAtivador) return allRows;
    const me = myAgente.toLowerCase();
    return allRows.filter(
      (r) => (r.agente_ativacao?.trim().toLowerCase() ?? "") === me,
    );
  })();

  // Macros agregados sempre usam allRows para mostrar números totais do pipe
  // (estoque/perfil/SLA/MRR ativado/novos hoje). RLS já garante que ativador
  // só veja os próprios deals — se quiser que veja só sua fatia, usar personalRows aqui.
  const macroRows = allRows;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
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
            {/* Bloco 1 — Macros */}
            <MacroEstoque
              rows={macroRows}
              perfis={data.perfis}
              onTotalClick={() => setEstoqueOpen(true)}
            />

            <MacroMovimento rows={macroRows} />

            <CarteiraPorAtivador rows={macroRows} />

            {/* Bloco 2 — Lista linha-a-linha */}
            <DealsTable
              rows={personalRows}
              hideAtivadorFilter={isAtivador && !isAdmin}
            />
          </>
        )}
      </main>

      <EstoqueModal
        open={estoqueOpen}
        onOpenChange={setEstoqueOpen}
        rows={macroRows}
      />
    </div>
  );
};

export default Index;
