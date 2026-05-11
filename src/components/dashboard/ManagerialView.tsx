import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Users, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "./PeriodFilter";
import { SlaBandBar } from "./SlaBandBar";
import { DealLink } from "./DealLink";
import {
  SLA_BAND_META,
  computeFiltered,
  filterByPeriod,
  fmtBRL,
  fmtBRLk,
  fmtDias,
  fmtPct,
  type DashRow,
  type OperatorStat,
  type PeriodKey,
  type SlaBand,
} from "@/hooks/useDashOperacoes";

const ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];
type SortKey = "critico" | "ativos" | "mrr" | "tempo";

const toNum = (v: string) => {
  if (!v) return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

interface Props {
  rows: DashRow[];
  totalRows: number;
}

type P75Filter = "all" | "acima" | "abaixo";

export const ManagerialView = ({ rows, totalRows }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("tudo");
  const [mrrMin, setMrrMin] = useState("");
  const [mrrMax, setMrrMax] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("critico");
  const [selectedNome, setSelectedNome] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<Set<SlaBand>>(new Set());
  const [p75Filter, setP75Filter] = useState<P75Filter>("all");

  // P75 do SLA desde a criação, calculado sobre o recorte de período
  const { p75Criacao, byPeriod } = useMemo(() => {
    const byPeriod = filterByPeriod(rows, period);
    const dias = byPeriod
      .map((r) => parseFloat(String(r.sla_dias_criacao ?? "").replace(",", ".")))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const idx = dias.length ? Math.min(dias.length - 1, Math.floor(0.75 * dias.length)) : 0;
    return { p75Criacao: dias.length ? dias[idx] : 0, byPeriod };
  }, [rows, period]);

  const p75Counts = useMemo(() => {
    let acima = 0, abaixo = 0;
    for (const r of byPeriod) {
      const n = parseFloat(String(r.sla_dias_criacao ?? "").replace(",", "."));
      if (!Number.isFinite(n)) continue;
      if (n > p75Criacao) acima++;
      else abaixo++;
    }
    return { acima, abaixo, todos: byPeriod.length };
  }, [byPeriod, p75Criacao]);

  const filteredRows = useMemo(() => {
    const min = toNum(mrrMin);
    const max = toNum(mrrMax);
    return byPeriod.filter((r) => {
      if (min !== null || max !== null) {
        const m = parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;
        if (min !== null && m < min) return false;
        if (max !== null && m > max) return false;
      }
      if (p75Filter !== "all") {
        const n = parseFloat(String(r.sla_dias_criacao ?? "").replace(",", "."));
        if (!Number.isFinite(n)) return false;
        if (p75Filter === "acima" && !(n > p75Criacao)) return false;
        if (p75Filter === "abaixo" && !(n <= p75Criacao)) return false;
      }
      return true;
    });
  }, [byPeriod, mrrMin, mrrMax, p75Filter, p75Criacao]);

  const periodCounts = useMemo<Partial<Record<PeriodKey, number>>>(() => {
    const periodos: PeriodKey[] = ["tudo", "hoje", "semana", "mes"];
    const out: Partial<Record<PeriodKey, number>> = {};
    for (const p of periodos) out[p] = filterByPeriod(rows, p).length;
    return out;
  }, [rows]);

  const operadores = useMemo(
    () => computeFiltered(filteredRows).operadores,
    [filteredRows],
  );

  const sortedOperadores = useMemo(() => {
    const list = [...operadores];
    list.sort((a, b) => {
      if (sortBy === "critico") return b.bands.critico - a.bands.critico || b.ativos - a.ativos;
      if (sortBy === "ativos") return b.ativos - a.ativos;
      if (sortBy === "mrr") return b.mrr - a.mrr;
      return b.tempoMedio - a.tempoMedio;
    });
    return list;
  }, [operadores, sortBy]);

  const selected = useMemo<OperatorStat | null>(() => {
    if (!sortedOperadores.length) return null;
    if (selectedNome) {
      const found = sortedOperadores.find((o) => o.nome === selectedNome);
      if (found) return found;
    }
    return sortedOperadores[0];
  }, [sortedOperadores, selectedNome]);

  // Totalizadores
  const totals = useMemo(() => {
    const ativos = filteredRows.length;
    const mrr = filteredRows.reduce(
      (s, r) => s + (parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0),
      0,
    );
    const criticos = filteredRows.filter((r) => {
      const n = parseFloat(String(r.sla_dias_etapa ?? "").replace(",", "."));
      return Number.isFinite(n) && n > 30;
    }).length;
    const operadoresN = operadores.length;
    return { ativos, mrr, criticos, operadoresN };
  }, [filteredRows, operadores.length]);

  // Detalhe: clientes agrupados por faixa SLA
  const term = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    const g: Record<SlaBand, OperatorStat["clientes"]> = {
      critico: [], atencao: [], alerta: [], saudavel: [],
    };
    if (!selected) return g;
    const filtered = selected.clientes.filter((c) => {
      if (bandFilter.size && !bandFilter.has(c.band)) return false;
      if (!term) return true;
      return (
        c.cliente.toLowerCase().includes(term) ||
        c.etapa.toLowerCase().includes(term) ||
        String(c.id).includes(term)
      );
    });
    for (const c of filtered) g[c.band].push(c);
    for (const k of ORDER) g[k].sort((a, b) => b.sla - a.sla);
    return g;
  }, [selected, term, bandFilter]);

  const totalFiltrados = ORDER.reduce((s, k) => s + grouped[k].length, 0);

  const toggleBand = (k: SlaBand) =>
    setBandFilter((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const hasLocalFilters = period !== "tudo" || !!mrrMin || !!mrrMax || p75Filter !== "all";

  return (
    <div className="space-y-6">
      {/* Cabeçalho + filtros locais */}
      <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Visão gerencial por operador
            </h3>
            <p className="font-small text-xs text-muted-foreground">
              {totals.ativos.toLocaleString("pt-BR")} clientes no escopo · {totals.operadoresN} ativador
              {totals.operadoresN === 1 ? "" : "es"} · {fmtBRLk(totals.mrr)} sob gestão
            </p>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} counts={periodCounts} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR
            </span>
            <Input
              type="number"
              inputMode="numeric"
              value={mrrMin}
              onChange={(e) => setMrrMin(e.target.value)}
              placeholder="mín"
              className="h-9 w-24 font-numeric"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              inputMode="numeric"
              value={mrrMax}
              onChange={(e) => setMrrMax(e.target.value)}
              placeholder="máx"
              className="h-9 w-24 font-numeric"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              P75 SLA criação
            </span>
            <span className="font-numeric text-xs font-semibold tabular-nums text-foreground">
              {Math.round(p75Criacao)}d
            </span>
            {(
              [
                { k: "all", label: "Todos", count: p75Counts.todos },
                { k: "acima", label: `> ${Math.round(p75Criacao)}d`, count: p75Counts.acima },
                { k: "abaixo", label: `≤ ${Math.round(p75Criacao)}d`, count: p75Counts.abaixo },
              ] as { k: P75Filter; label: string; count: number }[]
            ).map(({ k, label, count }) => (
              <button
                key={k}
                onClick={() => setP75Filter(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-subtitle text-xs transition",
                  p75Filter === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={p75Filter === k}
              >
                {label}
                <span className="font-numeric tabular-nums opacity-80">{count}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Ordenar por
            </span>
            {(
              [
                { k: "critico", label: "Críticos" },
                { k: "ativos", label: "Ativos" },
                { k: "mrr", label: "MRR" },
                { k: "tempo", label: "T. médio" },
              ] as { k: SortKey; label: string }[]
            ).map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 font-subtitle text-xs transition",
                  sortBy === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {hasLocalFilters && (
            <button
              onClick={() => {
                setPeriod("tudo");
                setMrrMin("");
                setMrrMax("");
                setP75Filter("all");
              }}
              className="rounded-lg px-2 py-1 font-subtitle text-xs text-muted-foreground hover:text-destructive"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* KPIs gerenciais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Ativadores"
          value={totals.operadoresN.toLocaleString("pt-BR")}
          hint={`${totals.ativos.toLocaleString("pt-BR")} clientes`}
        />
        <KpiTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="MRR sob gestão"
          value={fmtBRLk(totals.mrr)}
          hint={`base total ${totalRows.toLocaleString("pt-BR")}`}
        />
        <KpiTile
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Críticos >30d"
          value={totals.criticos.toLocaleString("pt-BR")}
          hint={totals.ativos ? fmtPct((totals.criticos / totals.ativos) * 100, 1) : "—"}
          tone="danger"
        />
        <KpiTile
          icon={<Clock className="h-4 w-4" />}
          label="Operador c/ mais críticos"
          value={selected?.nome ?? "—"}
          hint={selected ? `${selected.bands.critico} críticos · ${fmtDias(selected.tempoMedio)} médio` : ""}
          truncate
        />
      </div>

      {/* Master-detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista de operadores */}
        <div className="space-y-2 lg:max-h-[70vh] lg:overflow-auto lg:pr-1">
          {sortedOperadores.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center font-small text-xs text-muted-foreground">
              Nenhum operador no escopo atual.
            </p>
          )}
          {sortedOperadores.map((op) => {
            const active = selected?.nome === op.nome;
            const pctCritico = op.ativos ? (op.bands.critico / op.ativos) * 100 : 0;
            return (
              <button
                key={op.nome}
                onClick={() => setSelectedNome(op.nome)}
                className={cn(
                  "w-full rounded-xl border bg-card p-3 text-left transition hover:border-primary/40",
                  active
                    ? "border-primary ring-1 ring-primary/30 shadow-sm-soft"
                    : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                      {op.nome}
                    </p>
                    <p className="font-small text-[11px] text-muted-foreground">
                      {op.ativos} ativos · {fmtBRLk(op.mrr)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 font-numeric text-[11px] font-bold tabular-nums",
                      op.bands.critico > 0
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {op.bands.critico} críticos
                  </span>
                </div>
                <div className="mt-2">
                  <SlaBandBar bands={op.bands} height="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between font-small text-[11px] text-muted-foreground">
                  <span>T. médio {fmtDias(op.tempoMedio)}</span>
                  <span className={pctCritico > 10 ? "text-destructive" : ""}>
                    {fmtPct(pctCritico, 1)} crítico
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalhe do operador */}
        <div className="space-y-3">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Selecione um operador para ver os detalhes.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display text-xl font-semibold text-foreground">
                      {selected.nome}
                    </h4>
                    <p className="font-small text-xs text-muted-foreground">
                      {selected.ativos} clientes · {fmtBRL(selected.mrr)} sob gestão · SLA médio{" "}
                      {fmtDias(selected.tempoMedio)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MiniStat label="Críticos" value={selected.bands.critico} tone="danger" />
                    <MiniStat label="Atenção" value={selected.bands.atencao} tone="warning" />
                    <MiniStat label="Alerta" value={selected.bands.alerta} tone="alerta" />
                    <MiniStat label="Saudável" value={selected.bands.saudavel} tone="ok" />
                  </div>
                </div>
                <div className="mt-3">
                  <SlaBandBar bands={selected.bands} height="lg" showLabels />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar cliente, etapa ou ID do deal…"
                      className="pl-9 pr-9"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Limpar busca"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ORDER.map((k) => {
                      const meta = SLA_BAND_META[k];
                      const total = selected.bands[k];
                      const active = bandFilter.has(k);
                      const color = `hsl(var(${meta.cssVar}))`;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => toggleBand(k)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-subtitle text-xs font-medium transition",
                            active ? "shadow-sm-soft" : "hover:bg-muted/60",
                          )}
                          style={{
                            borderColor: active
                              ? color
                              : `${color.replace("hsl(", "hsla(").replace(")", ", 0.35)")}`,
                            backgroundColor: active
                              ? `${color.replace("hsl(", "hsla(").replace(")", ", 0.16)")}`
                              : "transparent",
                            color,
                          }}
                          aria-pressed={active}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          {meta.label}
                          <span className="font-numeric tabular-nums opacity-80">{total}</span>
                        </button>
                      );
                    })}
                    {bandFilter.size > 0 && (
                      <button
                        onClick={() => setBandFilter(new Set())}
                        className="rounded-full px-2 py-1 font-subtitle text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {(search || bandFilter.size > 0) && (
                  <p className="mt-2 font-small text-[11px] text-muted-foreground">
                    {totalFiltrados} cliente{totalFiltrados === 1 ? "" : "s"} encontrado
                    {totalFiltrados === 1 ? "" : "s"}
                  </p>
                )}

                <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto pr-1">
                  {ORDER.map((k) => {
                    const meta = SLA_BAND_META[k];
                    const list = grouped[k];
                    const color = `hsl(var(${meta.cssVar}))`;
                    if (list.length === 0) return null;
                    return (
                      <div
                        key={k}
                        className="overflow-hidden rounded-lg border"
                        style={{ borderColor: color }}
                      >
                        <div
                          className="flex items-center justify-between gap-3 px-3 py-2"
                          style={{
                            backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.08)")}`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <p className="font-subtitle text-xs font-semibold" style={{ color }}>
                              {meta.label} · {meta.range}
                            </p>
                          </div>
                          <p className="font-small text-[11px] text-muted-foreground">
                            {list.length} · {fmtBRL(selected.bandsMrr[k])}
                          </p>
                        </div>
                        <ul className="divide-y divide-border bg-card">
                          {list.map((c) => (
                            <li
                              key={c.id}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                                  <DealLink id={c.id}>{c.cliente}</DealLink>
                                </p>
                                <p className="truncate font-small text-[11px] text-muted-foreground">
                                  {c.etapa} · perfil {c.perfil}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3 text-right">
                                <span className="font-numeric text-xs text-muted-foreground">
                                  {c.mrr ? fmtBRL(c.mrr) : "—"}
                                </span>
                                <span
                                  className="rounded-full px-2 py-0.5 font-numeric text-xs font-bold tabular-nums"
                                  style={{
                                    backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.15)")}`,
                                    color,
                                  }}
                                >
                                  {c.sla.toFixed(0)}d
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {totalFiltrados === 0 && (
                    <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center font-small text-xs text-muted-foreground">
                      Nenhum cliente encontrado com os filtros aplicados.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiTile = ({
  icon,
  label,
  value,
  hint,
  tone,
  truncate,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
  truncate?: boolean;
}) => (
  <div
    className={cn(
      "rounded-xl border bg-card p-3 shadow-sm-soft",
      tone === "danger" ? "border-destructive/30" : "border-border",
    )}
  >
    <div className="flex items-center gap-1.5 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <p
      className={cn(
        "mt-1.5 font-display text-xl font-semibold text-foreground",
        truncate && "truncate",
      )}
      title={truncate ? value : undefined}
    >
      {value}
    </p>
    {hint && <p className="font-small text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const MiniStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "alerta" | "ok";
}) => {
  const cls =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : tone === "alerta"
          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  return (
    <div className={cn("rounded-lg border px-2.5 py-1.5 text-center", cls)}>
      <p className="font-numeric text-base font-bold tabular-nums leading-none">{value}</p>
      <p className="font-small text-[10px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
};
