import { Columns3 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KanbanFilters } from "@/components/sucesso/KanbanFilters";

export default function SucessoKanban() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Columns3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
              Sucesso
            </p>
            <h1 className="font-display text-xl font-semibold text-secondary">Kanban</h1>
          </div>
        </div>

        <KanbanFilters />

        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center font-small text-sm text-muted-foreground">
          Quadro Kanban em construção. Em breve as colunas com os cards dos clientes aparecem aqui.
        </div>
      </main>
    </div>
  );
}
