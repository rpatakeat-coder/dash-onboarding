import { useEffect, useMemo, useState } from "react";
import { X, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { OperatorsTable } from "@/components/dashboard/OperatorsTable";
import { OperatorCarteiraModal } from "@/components/dashboard/OperatorCarteiraModal";
import { StalledTable } from "@/components/dashboard/StalledTable";
import { SlaKpiRow } from "@/components/dashboard/SlaKpiRow";
import { PeriodGrids } from "@/components/dashboard/PeriodGrids";
import { AttentionPoints } from "@/components/dashboard/AttentionPoints";
import { SlaCritico } from "@/components/dashboard/SlaCritico";
import { EstoqueModal } from "@/components/dashboard/EstoqueModal";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { PeriodCompare, type CompareMetric } from "@/components/dashboard/PeriodCompare";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { Highlights } from "@/components/dashboard/Highlights";
import { BottleneckHeatmap } from "@/components/dashboard/BottleneckHeatmap";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { PerfilSlaPanel } from "@/components/dashboard/PerfilSlaPanel";
import { RiskRanking } from "@/components/dashboard/RiskRanking";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { useUrlSets } from "@/hooks/useUrlSets";
import { useDealDrawer } from "@/contexts/DealDrawer";
import { useSnapshotDeltas, type DeltaWindow } from "@/hooks/useSnapshotDeltas";
import {
  computeFiltered,
  computePeriodSummary,
  computeSlaKpis,
  filterByPeriod,
  fmtBRLk,
  fmtPct,
  slaBand,
  SLA_BAND_META,
  useDashOperacoes,
  type DashRow,
  type OperatorStat,
  type PeriodKey,
  type SlaBand,
} from "@/hooks/useDashOperacoes";

const BAND_ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];
const bandLabel = (b: SlaBand) => `${SLA_BAND_META[b].label} (${SLA_BAND_META[b].range})`;
const bandFromLabel = (l: string): SlaBand =>
  (BAND_ORDER.find((b) => bandLabel(b) === l) as SlaBand) ?? "saudavel";
const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const ScopeBadge = ({
  scope,
  destaque,
  destaqueLabel,
  total,
}: {
  scope: number;
  destaque: number;
  destaqueLabel: string;
  total: number;
}) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 font-numeric text-[11px] tabular-nums text-muted-foreground"
    title={`${scope.toLocaleString("pt-BR")} no escopo (após filtros) · ${destaque.toLocaleString("pt-BR")} ${destaqueLabel} · base total ${total.toLocaleString("pt-BR")}`}
  >
    <span className="font-semibold text-foreground">{scope.toLocaleString("pt-BR")}</span>
    <span>de {total.toLocaleString("pt-BR")}</span>
    <span className="opacity-60">·</span>
    <span className="text-destructive">{destaque.toLocaleString("pt-BR")} {destaqueLabel}</span>
  </span>
);

const Index = () => {
  const { data, error } = useDashOperacoes();
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<OperatorStat | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const op = (e as CustomEvent<OperatorStat>).detail;
      if (!op) return;
      setSelectedOperator(op);
      setOperatorOpen(true);
    };
    window.addEventListener("open-operator", handler);
    return () => window.removeEventListener("open-operator", handler);
  }, []);
  const [atencaoPeriod, setAtencaoPeriod] = useState<PeriodKey>("tudo");
  const [criticoPeriod, setCriticoPeriod] = useState<PeriodKey>("tudo");
  const [opPeriod, setOpPeriod] = useState<PeriodKey>("tudo");
  const [kpiPeriod, setKpiPeriod] = useState<PeriodKey>("tudo");
  const [slaCmpA, setSlaCmpA] = useState<PeriodKey>("semana");
  const [slaCmpB, setSlaCmpB] = useState<PeriodKey>("mes");
  const [execCmpA, setExecCmpA] = useState<PeriodKey>("semana");
  const [execCmpB, setExecCmpB] = useState<PeriodKey>("mes");
  const [ativadorSel, setAtivadorSel] = useState<Set<string>>(new Set());
  const [etapaSel, setEtapaSel] = useState<Set<string>>(new Set());
  const [bandSel, setBandSel] = useState<Set<string>>(new Set());
  const [perfilSel, setPerfilSel] = useState<Set<string>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [deltaWindow, setDeltaWindow] = useState<DeltaWindow>(7);
  const { data: deltas, isLoading: deltasLoading } = useSnapshotDeltas(deltaWindow);
  const { fullName } = useAuth();
  const { open: openDeal } = useDealDrawer();

  // Sincroniza filtros com a URL (compartilhável + sobrevive a reload)
  useUrlSets(
    { ativador: ativadorSel, etapa: etapaSel, band: bandSel, perfil: perfilSel },
    { ativador: setAtivadorSel, etapa: setEtapaSel, band: setBandSel, perfil: setPerfilSel },
    { mine: onlyMine },
    { mine: setOnlyMine },
  );

  const allRows = data?.rows ?? [];

  const perfilOf = (r: DashRow) =>
    (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();

  const bandSelKeys = useMemo(
    () => new Set([...bandSel].map(bandFromLabel)),
    [bandSel],
  );

  // Counts respect the OTHER dimensions' selections
  const ativadoresCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of allRows) {
      if (etapaSel.size && !etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa")) continue;
      if (bandSelKeys.size && !bandSelKeys.has(slaBand(slaOf(r)))) continue;
      const k = r.agente_ativacao?.trim() || "Sem responsável";
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [allRows, etapaSel, bandSelKeys]);

  const etapasCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of allRows) {
      if (
        ativadorSel.size &&
        !ativadorSel.has(r.agente_ativacao?.trim() || "Sem responsável")
      )
        continue;
      if (bandSelKeys.size && !bandSelKeys.has(slaBand(slaOf(r)))) continue;
      const k = r.etapa_negocio?.trim() || "Sem etapa";
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [allRows, ativadorSel, bandSelKeys]);

  const bandCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of allRows) {
      if (
        ativadorSel.size &&
        !ativadorSel.has(r.agente_ativacao?.trim() || "Sem responsável")
      )
        continue;
      if (etapaSel.size && !etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa")) continue;
      const k = bandLabel(slaBand(slaOf(r)));
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [allRows, ativadorSel, etapaSel]);

  const ativadoresOpts = useMemo(
    () => [...new Set(allRows.map((r) => r.agente_ativacao?.trim() || "Sem responsável"))],
    [allRows],
  );
  const etapasOpts = useMemo(
    () => [...new Set(allRows.map((r) => r.etapa_negocio?.trim() || "Sem etapa"))],
    [allRows],
  );
  const bandOpts = useMemo(() => BAND_ORDER.map(bandLabel), []);
  const perfilOpts = useMemo(
    () => [...new Set(allRows.map(perfilOf))].sort(),
    [allRows],
  );
  const perfilCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of allRows) {
      const k = perfilOf(r);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [allRows]);

  const rows = useMemo<DashRow[]>(
    () => {
      const me = onlyMine && fullName ? fullName.trim().toLowerCase() : null;
      return allRows.filter((r) => {
        if (
          ativadorSel.size &&
          !ativadorSel.has(r.agente_ativacao?.trim() || "Sem responsável")
        )
          return false;
        if (etapaSel.size && !etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa"))
          return false;
        if (bandSelKeys.size && !bandSelKeys.has(slaBand(slaOf(r)))) return false;
        if (perfilSel.size && !perfilSel.has(perfilOf(r))) return false;
        if (me && (r.agente_ativacao?.trim().toLowerCase() ?? "") !== me) return false;
        return true;
      });
    },
    [allRows, ativadorSel, etapaSel, bandSelKeys, perfilSel, onlyMine, fullName],
  );

  const atencaoData = useMemo(() => computeFiltered(filterByPeriod(rows, atencaoPeriod)), [rows, atencaoPeriod]);
  const criticoData = useMemo(() => computeFiltered(filterByPeriod(rows, criticoPeriod)), [rows, criticoPeriod]);
  const opData = useMemo(() => computeFiltered(filterByPeriod(rows, opPeriod)), [rows, opPeriod]);
  const kpiData = useMemo(
    () => computeSlaKpis(filterByPeriod(rows, kpiPeriod)),
    [rows, kpiPeriod],
  );
  const kpiCounts = useMemo<Partial<Record<PeriodKey, number>>>(() => {
    const periodos: PeriodKey[] = ["tudo", "hoje", "semana", "mes"];
    const out: Partial<Record<PeriodKey, number>> = {};
    for (const p of periodos) out[p] = filterByPeriod(rows, p).length;
    return out;
  }, [rows]);

  // Comparativos A vs B (compartilham contagens com kpiCounts)
  const slaCmp = useMemo(() => {
    const a = computeSlaKpis(filterByPeriod(rows, slaCmpA));
    const b = computeSlaKpis(filterByPeriod(rows, slaCmpB));
    return { a, b };
  }, [rows, slaCmpA, slaCmpB]);

  const execCmp = useMemo(() => {
    const a = computePeriodSummary(filterByPeriod(rows, execCmpA));
    const b = computePeriodSummary(filterByPeriod(rows, execCmpB));
    return { a, b };
  }, [rows, execCmpA, execCmpB]);

  const slaCmpMetrics = useMemo<CompareMetric[]>(
    () => [
      { label: "Estoque total", a: slaCmp.a.total, b: slaCmp.b.total, goodDirection: "down" },
      { label: "SLA médio", a: slaCmp.a.slaMedio, b: slaCmp.b.slaMedio, unit: "d", decimals: 1, goodDirection: "down" },
      { label: "% no prazo", a: slaCmp.a.noPrazo, b: slaCmp.b.noPrazo, unit: "%", decimals: 1, goodDirection: "up" },
      { label: "% SLA estourado", a: slaCmp.a.estourado, b: slaCmp.b.estourado, unit: "%", decimals: 1, goodDirection: "down" },
    ],
    [slaCmp],
  );

  const execCmpMetrics = useMemo<CompareMetric[]>(
    () => [
      { label: "Novos clientes", a: execCmp.a.novos, b: execCmp.b.novos, goodDirection: "up" },
      { label: "Ativados", a: execCmp.a.ativados, b: execCmp.b.ativados, goodDirection: "up" },
      { label: "MRR ativado", a: execCmp.a.mrrAtivado, b: execCmp.b.mrrAtivado, goodDirection: "up", fmt: fmtBRLk },
      { label: "% MRR ativado", a: execCmp.a.pctAtivado, b: execCmp.b.pctAtivado, decimals: 1, goodDirection: "up", fmt: (n) => fmtPct(n, 1) },
    ],
    [execCmp],
  );

  const travadosLista = useMemo(() => {
    const TRAVADO_DIAS = 7;
    return rows
      .map((r) => ({
        id: r.id_deal,
        cliente: r.nome_negocio?.trim() || "—",
        ativador: r.agente_ativacao?.trim() || "—",
        etapa: r.etapa_negocio?.trim() || "—",
        dias: slaOf(r),
      }))
      .filter((r) => r.dias > TRAVADO_DIAS)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 10);
  }, [rows]);

  const scopeCounts = useMemo(() => {
    const ETAPAS_ATENCAO = new Set(["Pré-Cancelamento", "Inativo", "Pendências", "Processo Pausado"]);
    const TRAVADO_DIAS = 7;
    const atencaoRows = filterByPeriod(rows, atencaoPeriod);
    const criticoRows = filterByPeriod(rows, criticoPeriod);
    const opRows = filterByPeriod(rows, opPeriod);
    return {
      atencao: {
        scope: atencaoRows.length,
        destaque: atencaoRows.filter((r) => ETAPAS_ATENCAO.has(r.etapa_negocio?.trim() || "")).length,
      },
      critico: {
        scope: criticoRows.length,
        destaque: criticoRows.filter((r) => slaOf(r) > 30).length,
      },
      operadores: {
        scope: opRows.length,
        destaque: opData.operadores.length,
      },
      travados: {
        scope: rows.length,
        destaque: rows.filter((r) => slaOf(r) > TRAVADO_DIAS).length,
      },
    };
  }, [rows, atencaoPeriod, criticoPeriod, opPeriod, opData.operadores.length]);

  const countsBy = useMemo(() => {
    const ETAPAS_ATENCAO = new Set(["Pré-Cancelamento", "Inativo", "Pendências", "Processo Pausado"]);
    const periodos: PeriodKey[] = ["tudo", "hoje", "semana", "mes"];
    const make = (predicate: (r: (typeof rows)[number]) => boolean) => {
      const out: Partial<Record<PeriodKey, number>> = {};
      for (const p of periodos) {
        out[p] = filterByPeriod(rows, p).filter(predicate).length;
      }
      return out;
    };
    return {
      atencao: make((r) => ETAPAS_ATENCAO.has(r.etapa_negocio?.trim() || "")),
      critico: make((r) => {
        const n = parseFloat(String(r.sla_dias ?? "").replace(",", "."));
        return Number.isFinite(n) && n > 30;
      }),
      operadores: make(() => true),
    };
  }, [rows]);

  const hasGlobalFilters = ativadorSel.size > 0 || etapaSel.size > 0 || bandSel.size > 0 || perfilSel.size > 0;

  const periodLabel = (p: PeriodKey) =>
    ({ tudo: "Tudo", hoje: "Hoje", semana: "Semana", mes: "Mês" }[p]);

  const pdfSummary = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    out.push({
      label: "Escopo",
      value: `${rows.length.toLocaleString("pt-BR")} de ${allRows.length.toLocaleString("pt-BR")} clientes`,
    });
    out.push({
      label: "Comparativo",
      value: `${deltaWindow}d vs ${deltaWindow}d anteriores`,
    });
    if (slaCmpA !== slaCmpB)
      out.push({
        label: "Comparativo SLA (A vs B)",
        value: `${periodLabel(slaCmpA)} vs ${periodLabel(slaCmpB)}`,
      });
    if (execCmpA !== execCmpB)
      out.push({
        label: "Comparativo Executivo (A vs B)",
        value: `${periodLabel(execCmpA)} vs ${periodLabel(execCmpB)}`,
      });
    const periodos: string[] = [];
    if (kpiPeriod !== "tudo") periodos.push(`KPIs: ${periodLabel(kpiPeriod)}`);
    if (atencaoPeriod !== "tudo") periodos.push(`Atenção: ${periodLabel(atencaoPeriod)}`);
    if (criticoPeriod !== "tudo") periodos.push(`Crítico: ${periodLabel(criticoPeriod)}`);
    if (opPeriod !== "tudo") periodos.push(`Operadores: ${periodLabel(opPeriod)}`);
    if (periodos.length) out.push({ label: "Períodos", value: periodos.join(" · ") });
    if (onlyMine && fullName) out.push({ label: "Visão", value: `Só meus deals (${fullName})` });
    // Critério segue a fonte de dados real do filtro:
    //  - Ativador: campo `agente_ativacao` (nome do responsável)
    //  - Etapa:    campo `etapa_negocio`  (fase do funil)
    //  - Faixa SLA: derivada de `sla_dias` (faixa de dias na fase)
    //  - Perfil:   campo `perfil_cliente` (segmento P/M/G/GG)
    const filterLabel = (base: string, criterio: string, n: number) =>
      `${base} (${n > 1 ? `${n} selecionados, ` : ""}por ${criterio})`;
    if (ativadorSel.size)
      out.push({
        label: filterLabel("Ativador", "nome", ativadorSel.size),
        value: [...ativadorSel].join(", "),
      });
    if (etapaSel.size)
      out.push({
        label: filterLabel("Etapa", "fase do funil", etapaSel.size),
        value: [...etapaSel].join(", "),
      });
    if (bandSel.size)
      out.push({
        label: filterLabel("Faixa SLA", "dias na fase", bandSel.size),
        value: [...bandSel].join(", "),
      });
    if (perfilSel.size)
      out.push({
        label: filterLabel("Perfil", "segmento", perfilSel.size),
        value: [...perfilSel].join(", "),
      });
    return out;
  }, [rows.length, allRows.length, deltaWindow, kpiPeriod, atencaoPeriod, criticoPeriod, opPeriod, slaCmpA, slaCmpB, execCmpA, execCmpB, onlyMine, fullName, ativadorSel, etapaSel, bandSel, perfilSel]);


  return (
    <div className="min-h-screen bg-gradient-surface">
      <DashboardHeader />

      <main id="dashboard-pdf-root" className="mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
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
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pdf-hide">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Indicadores de SLA
              </h3>
              <p className="font-small text-xs text-muted-foreground">
                {kpiPeriod === "tudo"
                  ? "Considera todo o estoque atual"
                  : `Apenas clientes criados em "${
                      { hoje: "Hoje", semana: "Semana", mes: "Mês" }[kpiPeriod]
                    }"`}
              </p>
            </div>
            <PeriodFilter value={kpiPeriod} onChange={setKpiPeriod} counts={kpiCounts} />
          </div>
          <SlaKpiRow
            total={kpiData.total}
            slaP75={kpiData.slaP75}
            slaMedio={kpiData.slaMedio}
            noPrazo={kpiData.noPrazo}
            noPrazoCount={kpiData.noPrazoCount}
            estourado={kpiData.estourado}
            estouradoCount={kpiData.estouradoCount}
            onEstoqueClick={() => setEstoqueOpen(true)}
            deltas={deltas}
            deltasLoading={deltasLoading}
            windowDays={deltaWindow}
            onChangeWindow={setDeltaWindow}
          />
          <PeriodCompare
            title="Comparar SLA entre períodos"
            caption="Escolha dois recortes do estoque atual para ver a diferença em cada KPI."
            periodA={slaCmpA}
            periodB={slaCmpB}
            onChangeA={setSlaCmpA}
            onChangeB={setSlaCmpB}
            countsA={kpiCounts}
            countsB={kpiCounts}
            metrics={slaCmpMetrics}
          />
        </div>

        <EstoqueModal
          open={estoqueOpen}
          onOpenChange={setEstoqueOpen}
          rows={rows}
        />

        <OperatorCarteiraModal
          operador={selectedOperator}
          open={operatorOpen}
          onOpenChange={setOperatorOpen}
        />

        {/* Filtros globais (Ativador + Etapa) */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Filtrar por
          </span>
          {fullName && (
            <button
              onClick={() => setOnlyMine((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-subtitle text-xs font-medium transition ${
                onlyMine
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
              title={`Mostrar apenas clientes de ${fullName}`}
            >
              <UserCheck className="h-3 w-3" /> Só meus deals
            </button>
          )}
          <MultiSelectFilter
            label="Ativador"
            options={ativadoresOpts}
            counts={ativadoresCounts}
            selected={ativadorSel}
            onChange={setAtivadorSel}
          />
          <MultiSelectFilter
            label="Etapa"
            options={etapasOpts}
            counts={etapasCounts}
            selected={etapaSel}
            onChange={setEtapaSel}
          />
          <MultiSelectFilter
            label="Faixa SLA"
            options={bandOpts}
            counts={bandCounts}
            selected={bandSel}
            onChange={setBandSel}
          />
          <MultiSelectFilter
            label="Perfil"
            options={perfilOpts}
            counts={perfilCounts}
            selected={perfilSel}
            onChange={setPerfilSel}
          />
          {hasGlobalFilters && (
            <>
              <span className="font-small text-xs text-muted-foreground">
                {rows.length.toLocaleString("pt-BR")} de {allRows.length.toLocaleString("pt-BR")} clientes
              </span>
              <button
                onClick={() => {
                  setAtivadorSel(new Set());
                  setEtapaSel(new Set());
                  setBandSel(new Set());
                  setPerfilSel(new Set());
                }}
                className="rounded-lg px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-destructive"
              >
                Limpar filtros
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-2 pdf-hide">
            <ExportCsvButton rows={rows} />
            <ExportPdfButton summary={pdfSummary} />
          </div>

          {hasGlobalFilters && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                Ativos:
              </span>
              {[...ativadorSel].map((v) => (
                <span
                  key={`a-${v}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-subtitle text-xs font-medium text-primary"
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Ativador</span>
                  <span>{v}</span>
                  <button
                    onClick={() => {
                      const n = new Set(ativadorSel);
                      n.delete(v);
                      setAtivadorSel(n);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                    aria-label={`Remover ${v}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {[...etapaSel].map((v) => (
                <span
                  key={`e-${v}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 font-subtitle text-xs font-medium text-secondary"
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Etapa</span>
                  <span>{v}</span>
                  <button
                    onClick={() => {
                      const n = new Set(etapaSel);
                      n.delete(v);
                      setEtapaSel(n);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-secondary/20"
                    aria-label={`Remover ${v}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {[...bandSel].map((v) => {
                const color = `hsl(var(${SLA_BAND_META[bandFromLabel(v)].cssVar}))`;
                return (
                  <span
                    key={`b-${v}`}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-subtitle text-xs font-medium"
                    style={{ borderColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.35)")}`, backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.12)")}`, color }}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-70">SLA</span>
                    <span>{v}</span>
                    <button
                      onClick={() => {
                        const n = new Set(bandSel);
                        n.delete(v);
                        setBandSel(n);
                      }}
                      className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
                      aria-label={`Remover ${v}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {[...perfilSel].map((v) => (
                <span
                  key={`p-${v}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-subtitle text-xs font-medium text-accent-foreground"
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Perfil</span>
                  <span>{v}</span>
                  <button
                    onClick={() => {
                      const n = new Set(perfilSel);
                      n.delete(v);
                      setPerfilSel(n);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20"
                    aria-label={`Remover ${v}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Destaques automáticos */}
        {data && opData.operadores.length > 0 && (
          <section className="mb-8">
            <Highlights rows={rows} operadores={opData.operadores} />
          </section>
        )}

        {/* Períodos + Perfis + MRR Ativado */}
        <div className="mb-8 space-y-6">
          {data && (
            <PeriodGrids
              hoje={data.hoje}
              semana={data.semana}
              mes={data.mes}
              mesAnterior={data.mesAnterior}
              perfis={data.perfis}
            />
          )}
          <PeriodCompare
            title="Comparar painel executivo entre períodos"
            caption="Compare entradas, ativações e MRR entre dois recortes (ex.: Semana vs Mês)."
            periodA={execCmpA}
            periodB={execCmpB}
            onChangeA={setExecCmpA}
            onChangeB={setExecCmpB}
            countsA={kpiCounts}
            countsB={kpiCounts}
            metrics={execCmpMetrics}
          />
        </div>

        {/* Pontos de atenção */}
        {data && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Pontos de atenção
                </h3>
                <ScopeBadge
                  scope={scopeCounts.atencao.scope}
                  destaque={scopeCounts.atencao.destaque}
                  destaqueLabel="em etapas críticas"
                  total={allRows.length}
                />
              </div>
              <PeriodFilter value={atencaoPeriod} onChange={setAtencaoPeriod} counts={countsBy.atencao} />
            </div>
            <AttentionPoints atencao={atencaoData.atencao} topMrrTravado={atencaoData.topMrrTravado} />
          </section>
        )}

        {/* Funil + SLA crítico */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FunnelChart data={data?.porEtapa ?? []} total={data?.total ?? 0} />
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  SLA crítico
                </h3>
                <ScopeBadge
                  scope={scopeCounts.critico.scope}
                  destaque={scopeCounts.critico.destaque}
                  destaqueLabel="acima de 30d"
                  total={allRows.length}
                />
              </div>
              <PeriodFilter value={criticoPeriod} onChange={setCriticoPeriod} counts={countsBy.critico} />
            </div>
            <SlaCritico criticos={criticoData.criticos} />
          </div>
        </section>

        {/* Tendência + Top risco */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TrendChart />
          <RiskRanking rows={rows} limit={10} />
        </section>

        {/* Heatmap de gargalos + SLA por perfil */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BottleneckHeatmap rows={rows} />
          <PerfilSlaPanel rows={rows} />
        </section>

        {/* Ranking de ativadores vs metas */}
        {opData.operadores.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Ranking vs metas
              </h3>
              <ScopeBadge
                scope={scopeCounts.operadores.scope}
                destaque={opData.operadores.length}
                destaqueLabel="ativadores"
                total={allRows.length}
              />
            </div>
            <RankingTable
              operadores={opData.operadores}
              onOperatorClick={(op) => {
                setSelectedOperator(op);
                setOperatorOpen(true);
              }}
            />
          </section>
        )}

        {/* Performance por ativador */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Performance por ativador
              </h3>
              <ScopeBadge
                scope={scopeCounts.operadores.scope}
                destaque={scopeCounts.operadores.destaque}
                destaqueLabel="ativadores"
                total={allRows.length}
              />
            </div>
            <PeriodFilter value={opPeriod} onChange={setOpPeriod} counts={countsBy.operadores} />
          </div>
          <OperatorsTable
            operadores={opData.operadores}
            onOperatorClick={(op) => {
              setSelectedOperator(op);
              setOperatorOpen(true);
            }}
          />
        </section>

        {/* Travados */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Onboardings travados
            </h3>
            <ScopeBadge
              scope={scopeCounts.travados.scope}
              destaque={scopeCounts.travados.destaque}
              destaqueLabel="travados >7d"
              total={allRows.length}
            />
          </div>
          <StalledTable
            travados={travadosLista}
            onRowClick={(id) => {
              const row = allRows.find((r) => r.id_deal === id);
              if (row) openDeal(row);
            }}
          />
        </section>

        <footer className="pt-4 text-center font-small text-xs text-muted-foreground">
          Takeat · Painel interno do time de Operações
        </footer>
      </main>
    </div>
  );
};

export default Index;
