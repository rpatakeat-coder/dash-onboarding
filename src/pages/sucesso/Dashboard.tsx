import { useMemo, useState } from "react";
import { LayoutDashboard, Users, DollarSign, UserCheck, Building2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MacroFilters, type MacroPeriodKey, type CustomRange } from "@/components/dashboard/MacroFilters";
import { CarteiraPorAgente } from "@/components/sucesso/CarteiraPorAgente";
import { RiscoEstoque } from "@/components/sucesso/RiscoEstoque";
import { ChurnSucesso } from "@/components/sucesso/ChurnSucesso";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import {
  useDashSucesso,
  applySucessoFilter,
  selectOverview,
  selectCarteira,
  fmtBRL,
  fmtPct,
} from "@/hooks/useDashSucesso";
import type { DashRow } from "@/hooks/useDashOperacoes";

// Etapas que iniciam OCULTAS por padrão (visão de base ativa): Estorno e Churn.
// Casamento por "contém" (normalizado) para não depender da grafia exata do banco
// (ex.: "Estorno", "Estorno - Comercial", "Churn", "Churn - Cancelado"...).
const normEtapa = (s: string) =>
  s.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
const isEtapaOcultaPadrao = (etapa: string) => {
  const e = normEtapa(etapa);
  return e.includes("churn") || e.includes("estorno");
};
// Enquanto o usuário não personalizar o "Ocultar fase", o conjunto oculto é
// sempre o default (Estorno + Churn). Esta chave marca que ele já personalizou.
const ETAPAS_CUSTOM_KEY = "sucesso:etapas:custom";

export default function SucessoDashboard() {
  // Estado de filtros compartilhado (espelha Onboarding: useState + usePersistedSet)
  const [filtroAgentes, setFiltroAgentes] = usePersistedSet("sucesso:agentes");
  const [filtroEtapas, setFiltroEtapas] = usePersistedSet("sucesso:etapas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<MacroPeriodKey>("tudo");
  const [filtroCustomRange, setFiltroCustomRange] = useState<CustomRange | null>(null);
  const [filtroPerfil, setFiltroPerfil] = useState<"P+M" | "G+GG" | null>(null);
  // O usuário já personalizou o "Ocultar fase"? Enquanto não, vale o default.
  const [etapasCustom, setEtapasCustom] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ETAPAS_CUSTOM_KEY) === "1";
    } catch {
      return false;
    }
  });

  // rowsRaw = base sem filtro (alimenta opções do MacroFilters e os recortes
  // abaixo). Filtramos no componente porque o conjunto efetivo de etapas ocultas
  // depende de rowsRaw (default derivado dos dados).
  const { rowsRaw, isLoading, error } = useDashSucesso(useMemo(() => ({}), []));

  // Rótulos reais (grafia do banco) das etapas que devem iniciar ocultas.
  const defaultOcultarLabels = useMemo(
    () =>
      Array.from(
        new Set(
          rowsRaw
            .map((r) => r.etapa_negocio?.trim())
            .filter((e): e is string => !!e)
            .filter((e) => isEtapaOcultaPadrao(e)),
        ),
      ),
    [rowsRaw],
  );

  // Conjunto EFETIVO de etapas ocultas: default (Estorno + Churn) até o usuário
  // personalizar; depois disso, exatamente o que ele escolheu (inclusive vazio).
  const ocultarEtapas = useMemo(
    () => (etapasCustom ? filtroEtapas : new Set(defaultOcultarLabels)),
    [etapasCustom, filtroEtapas, defaultOcultarLabels],
  );

  // Recorte principal (alimenta Estoque em Risco e Carteira por Agente).
  const rows = useMemo(
    () =>
      applySucessoFilter(rowsRaw, {
        agentes: filtroAgentes,
        ocultarEtapas,
        periodo: filtroPeriodo,
        customRange: filtroCustomRange,
        perfilGrupo: filtroPerfil,
      }),
    [rowsRaw, filtroAgentes, ocultarEtapas, filtroPeriodo, filtroCustomRange, filtroPerfil],
  );
  const carteira = useMemo(() => selectCarteira(rows), [rows]);

  // Qualquer interação com o "Ocultar fase" marca como personalizado e persiste.
  const handleEtapasChange = (next: Set<string>) => {
    if (!etapasCustom) {
      setEtapasCustom(true);
      try {
        window.localStorage.setItem(ETAPAS_CUSTOM_KEY, "1");
      } catch {
        /* storage indisponível — ignora */
      }
    }
    setFiltroEtapas(next);
  };

  // Visão Geral + Segmentação respeitam agentes/período/ocultar-fase, mas NÃO o
  // perfil (os cards P+M e G+GG precisam sempre mostrar os dois lados).
  const ov = useMemo(() => {
    const ovRows = applySucessoFilter(rowsRaw, {
      agentes: filtroAgentes,
      ocultarEtapas,
      periodo: filtroPeriodo,
      customRange: filtroCustomRange,
    });
    // excludeChurn:false → quem decide se churn entra é o "Ocultar fase".
    return selectOverview(ovRows, { excludeChurn: false });
  }, [rowsRaw, filtroAgentes, ocultarEtapas, filtroPeriodo, filtroCustomRange]);

  // Bloco de Churn é a única exceção: ele ANALISA churn, então recebe os dados
  // sem o recorte de "Ocultar fase" (senão ficaria sempre vazio).
  const churnRows = useMemo(
    () =>
      applySucessoFilter(rowsRaw, {
        agentes: filtroAgentes,
        periodo: filtroPeriodo,
        customRange: filtroCustomRange,
        perfilGrupo: filtroPerfil,
      }),
    [rowsRaw, filtroAgentes, filtroPeriodo, filtroCustomRange, filtroPerfil],
  );

  // Adapter: MacroFilters tipa em DashRow (Onboarding). Mapeamos só o necessário.
  const macroRows = useMemo(
    () =>
      rowsRaw.map((r) => ({
        agente_ativacao: r.agente_sucesso ?? null,
        etapa_negocio: r.etapa_negocio ?? null,
      })) as unknown as DashRow[],
    [rowsRaw],
  );

  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  const togglePerfil = (g: "P+M" | "G+GG") =>
    setFiltroPerfil((cur) => (cur === g ? null : g));
  const clearPerfil = () => setFiltroPerfil(null);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
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
        </div>

        {/* Filtros compartilhados — alimentam TODOS os blocos via SucessoFilter */}
        <MacroFilters
          rows={macroRows}
          ativadores={filtroAgentes}
          etapas={ocultarEtapas}
          onAtivadoresChange={setFiltroAgentes}
          onEtapasChange={handleEtapasChange}
          periodo={filtroPeriodo}
          onPeriodoChange={setFiltroPeriodo}
          customRange={filtroCustomRange}
          onCustomRangeChange={setFiltroCustomRange}
        />


        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
              Visão Geral do Pipeline
            </h2>
            {filtroPerfil && (
              <button
                onClick={clearPerfil}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Filtro ativo: <span className="text-foreground">{filtroPerfil}</span> · limpar ✕
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Erro ao carregar visão geral: {(error as Error).message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={clearPerfil}
              aria-pressed={filtroPerfil === null}
              className={`text-left rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filtroPerfil === null ? "ring-2 ring-primary/40" : "hover:-translate-y-0.5"
              }`}
            >
              <KpiCard
                label="Total de Clientes no Pipeline"
                value={isLoading ? "—" : ov.totalClientes.toLocaleString("pt-BR")}
                icon={Users}
                tone="primary"
                hint={filtroPerfil ? "Clique para limpar o filtro de perfil" : "Base ativa (sem Estorno-Comercial e Churn por padrão)"}
              />
            </button>
            <button
              type="button"
              onClick={clearPerfil}
              aria-pressed={filtroPerfil === null}
              className={`text-left rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filtroPerfil === null ? "ring-2 ring-primary/40" : "hover:-translate-y-0.5"
              }`}
            >
              <KpiCard
                label="MRR Acumulado Total"
                value={isLoading ? "—" : fmtBRL(ov.mrrTotal)}
                icon={DollarSign}
                tone="success"
                hint={filtroPerfil ? "Clique para limpar o filtro de perfil" : "Receita recorrente mensal consolidada"}
              />
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            Segmentação de Base e Receita
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => togglePerfil("P+M")}
              aria-pressed={filtroPerfil === "P+M"}
              className={`group relative overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filtroPerfil === "P+M" ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
                    Perfil P+M {filtroPerfil === "P+M" && <span className="ml-1 text-primary">●</span>}
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        Clientes
                      </p>
                      <p className="font-numeric text-3xl font-bold text-foreground">
                        {isLoading
                          ? "—"
                          : `${ov.qtdPM.toLocaleString("pt-BR")} `}
                        {!isLoading && (
                          <span className="font-numeric text-base font-semibold text-muted-foreground">
                            ({fmtPct(pct(ov.qtdPM, ov.totalClientes), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        MRR
                      </p>
                      <p className="font-numeric text-2xl font-bold text-foreground">
                        {isLoading ? "—" : fmtBRL(ov.mrrPM)}{" "}
                        {!isLoading && (
                          <span className="font-numeric text-sm font-semibold text-muted-foreground">
                            ({fmtPct(pct(ov.mrrPM, ov.mrrTotal), 1)})
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
            </button>

            <button
              type="button"
              onClick={() => togglePerfil("G+GG")}
              aria-pressed={filtroPerfil === "G+GG"}
              className={`group relative overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-sm-soft transition-all hover:shadow-md-soft hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filtroPerfil === "G+GG" ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
                    Perfil G+GG {filtroPerfil === "G+GG" && <span className="ml-1 text-primary">●</span>}
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        Clientes
                      </p>
                      <p className="font-numeric text-3xl font-bold text-foreground">
                        {isLoading
                          ? "—"
                          : `${ov.qtdGGG.toLocaleString("pt-BR")} `}
                        {!isLoading && (
                          <span className="font-numeric text-base font-semibold text-muted-foreground">
                            ({fmtPct(pct(ov.qtdGGG, ov.totalClientes), 1)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-small text-[11px] uppercase tracking-wide text-muted-foreground">
                        MRR
                      </p>
                      <p className="font-numeric text-2xl font-bold text-foreground">
                        {isLoading ? "—" : fmtBRL(ov.mrrGGG)}{" "}
                        {!isLoading && (
                          <span className="font-numeric text-sm font-semibold text-muted-foreground">
                            ({fmtPct(pct(ov.mrrGGG, ov.mrrTotal), 1)})
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
            </button>
          </div>

          {!isLoading && ov.qtdSemPerfil > 0 && (
            <p className="font-small text-xs text-muted-foreground">
              Obs.: {ov.qtdSemPerfil.toLocaleString("pt-BR")} clientes sem perfil
              definido ({fmtPct(pct(ov.qtdSemPerfil, ov.totalClientes), 1)}) —{" "}
              {fmtBRL(ov.mrrSemPerfil)} em MRR.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <CarteiraPorAgente
            agentes={carteira}
            totalClientes={ov.totalClientes}
            totalMrr={ov.mrrTotal}
            selectedAgentes={filtroAgentes}
            onToggleAgente={(a) => {
              const next = new Set(filtroAgentes);
              if (next.has(a)) next.delete(a);
              else next.add(a);
              setFiltroAgentes(next);
            }}
            onClearAgentes={() => setFiltroAgentes(new Set())}
          />
        </section>

        <RiscoEstoque
          rows={rows}
          totalClientes={ov.totalClientes}
          mrrTotal={ov.mrrTotal}
          qtdPMTotal={ov.qtdPM}
          qtdGGGTotal={ov.qtdGGG}
          mrrPMTotal={ov.mrrPM}
          mrrGGGTotal={ov.mrrGGG}
        />

        <ChurnSucesso
          rows={churnRows}
          qtdPMTotal={ov.qtdPM}
          qtdGGGTotal={ov.qtdGGG}
          mrrPMTotal={ov.mrrPM}
          mrrGGGTotal={ov.mrrGGG}
        />




      </main>
    </div>
  );
}
