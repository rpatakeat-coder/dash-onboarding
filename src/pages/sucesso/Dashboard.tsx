import { LayoutDashboard, Users, DollarSign, UserCheck, Building2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CarteiraPorAgente } from "@/components/sucesso/CarteiraPorAgente";
import { RiscoEstoque } from "@/components/sucesso/RiscoEstoque";
import { useDashSucesso, useSucessoOverviewView, fmtBRL, fmtPct } from "@/hooks/useDashSucesso";

export default function SucessoDashboard() {
  const { data, isLoading, error } = useSucessoOverviewView();
  const { rows, carteira } = useDashSucesso();

  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);


  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
              Sucesso
            </p>
            <h1 className="font-display text-xl font-semibold text-secondary">
              Dashboard de Sucesso
            </h1>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            Visão Geral do Pipeline
          </h2>

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Erro ao carregar visão geral: {(error as Error).message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCard
              label="Total de Clientes no Pipeline"
              value={isLoading || !data ? "—" : data.total_clientes.toLocaleString("pt-BR")}
              icon={Users}
              tone="primary"
              hint="Clientes ativos no pipeline de Sucesso/Retenção"
            />
            <KpiCard
              label="MRR Acumulado Total"
              value={isLoading || !data ? "—" : fmtBRL(data.mrr_total)}
              icon={DollarSign}
              tone="success"
              hint="Receita recorrente mensal consolidada"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            Segmentação de Base e Receita
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
                    Perfil P+M
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        Clientes
                      </p>
                      <p className="font-numeric text-3xl font-bold text-foreground">
                        {isLoading || !data
                          ? "—"
                          : `${data.qtd_pm.toLocaleString("pt-BR")} `}
                        {data && (
                          <span className="font-numeric text-base font-semibold text-muted-foreground">
                            ({fmtPct(pct(data.qtd_pm, data.total_clientes), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        MRR
                      </p>
                      <p className="font-numeric text-2xl font-bold text-foreground">
                        {isLoading || !data ? "—" : fmtBRL(data.mrr_pm)}{" "}
                        {data && (
                          <span className="font-numeric text-sm font-semibold text-muted-foreground">
                            ({fmtPct(pct(data.mrr_pm, data.mrr_total), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <UserCheck className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
                    Perfil G+GG
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        Clientes
                      </p>
                      <p className="font-numeric text-3xl font-bold text-foreground">
                        {isLoading || !data
                          ? "—"
                          : `${data.qtd_ggg.toLocaleString("pt-BR")} `}
                        {data && (
                          <span className="font-numeric text-base font-semibold text-muted-foreground">
                            ({fmtPct(pct(data.qtd_ggg, data.total_clientes), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        MRR
                      </p>
                      <p className="font-numeric text-2xl font-bold text-foreground">
                        {isLoading || !data ? "—" : fmtBRL(data.mrr_ggg)}{" "}
                        {data && (
                          <span className="font-numeric text-sm font-semibold text-muted-foreground">
                            ({fmtPct(pct(data.mrr_ggg, data.mrr_total), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </div>
            </div>
          </div>

          {data && data.qtd_sem_perfil > 0 && (
            <p className="font-small text-xs text-muted-foreground">
              Obs.: {data.qtd_sem_perfil.toLocaleString("pt-BR")} clientes sem perfil
              definido ({fmtPct(pct(data.qtd_sem_perfil, data.total_clientes), 1)}) —{" "}
              {fmtBRL(data.mrr_sem_perfil)} em MRR.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <CarteiraPorAgente
            agentes={carteira}
            totalClientes={data?.total_clientes ?? 0}
            totalMrr={data?.mrr_total ?? 0}
          />
        </section>

        <RiscoEstoque
          rows={rows}
          totalClientes={data?.total_clientes ?? 0}
          mrrTotal={data?.mrr_total ?? 0}
          qtdPMTotal={data?.qtd_pm ?? 0}
          qtdGGGTotal={data?.qtd_ggg ?? 0}
          mrrPMTotal={data?.mrr_pm ?? 0}
          mrrGGGTotal={data?.mrr_ggg ?? 0}
        />

        <ChurnSucesso
          rows={rows}
          qtdPMTotal={data?.qtd_pm ?? 0}
          qtdGGGTotal={data?.qtd_ggg ?? 0}
          mrrPMTotal={data?.mrr_pm ?? 0}
          mrrGGGTotal={data?.mrr_ggg ?? 0}
        />




      </main>
    </div>
  );
}
