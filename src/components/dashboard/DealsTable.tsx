import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { ExportCsvButton } from "./ExportCsvButton";
import { useDealDrawer } from "@/contexts/DealDrawer";
import { cn } from "@/lib/utils";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import {
  SLA_BAND_META,
  slaBand,
  type DashRow,
  type SlaBand,
} from "@/hooks/useDashOperacoes";

const BAND_ORDER: SlaBand[] = ["critico", "atencao", "alerta", "saudavel"];
const bandLabel = (b: SlaBand) => `${SLA_BAND_META[b].label} (${SLA_BAND_META[b].range})`;
const bandFromLabel = (l: string): SlaBand =>
  (BAND_ORDER.find((b) => bandLabel(b) === l) as SlaBand) ?? "saudavel";

const toNum = (v: string | null | undefined) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const perfilOf = (r: DashRow) =>
  (r.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase();

type SortKey = "nome" | "etapa" | "criacao" | "fase" | "ativador" | "perfil" | "mrr" | "mrrAsaas" | "delta";
type SortDir = "asc" | "desc";

const EPS_DIV = 0.5;
const fmtBRL0 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BandPill = ({ dias }: { dias: number }) => {
  const b = slaBand(dias);
  const meta = SLA_BAND_META[b];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-numeric text-xs font-bold tabular-nums"
      style={{
        backgroundColor: `hsla(var(${meta.cssVar}), 0.12)`,
        color: `hsl(var(${meta.cssVar}))`,
      }}
      title={meta.label}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `hsl(var(${meta.cssVar}))` }}
      />
      {dias}d
    </span>
  );
};

interface Props {
  rows: DashRow[];
  /** Quando ativador não-admin, esconde o filtro de ativador (já filtrado por RLS). */
  hideAtivadorFilter?: boolean;
}

const PAGE_SIZE_OPTS = [25, 50, 100, 200];

export const DealsTable = ({ rows: rowsRaw, hideAtivadorFilter }: Props) => {
  // Lista de deals oculta a pipeline "Sucesso" (mas KPIs de MRR Ativado seguem considerando).
  const rows = useMemo(
    () => rowsRaw.filter((r) => (r.pipeline_nome?.trim().toLowerCase() ?? "") !== "sucesso"),
    [rowsRaw],
  );
  const { open: openDeal } = useDealDrawer();
  const [bandSel, setBandSel] = usePersistedSet("dealsTable:band");
  const [etapaSel, setEtapaSel] = usePersistedSet("dealsTable:etapa");
  const [ativSel, setAtivSel] = usePersistedSet("dealsTable:ativ");
  const [perfilSel, setPerfilSel] = usePersistedSet("dealsTable:perfil");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fase");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [onlyDivergentes, setOnlyDivergentes] = useState(false);


  const etapaOpts = useMemo(
    () => [
      ...new Set(
        rows
          .map((r) => r.etapa_negocio?.trim() || "Sem etapa")
          .filter((e) => !/^\d+$/.test(e)),
      ),
    ],
    [rows],
  );
  const ativOpts = useMemo(
    () => [...new Set(rows.map((r) => r.agente_ativacao?.trim() || "Sem responsável"))],
    [rows],
  );
  const perfilOpts = useMemo(() => {
    const order = ["P", "M", "G", "GG"];
    const uniq = [...new Set(rows.map(perfilOf))];
    return uniq.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [rows]);
  const bandOpts = useMemo(() => BAND_ORDER.map(bandLabel), []);

  const bandKeys = useMemo(() => new Set([...bandSel].map(bandFromLabel)), [bandSel]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (etapaSel.size && etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa")) return false;
      if (ativSel.size && !ativSel.has(r.agente_ativacao?.trim() || "Sem responsável")) return false;
      if (perfilSel.size && !perfilSel.has(perfilOf(r))) return false;
      if (bandKeys.size && !bandKeys.has(slaBand(toNum(r.sla_dias_etapa)))) return false;
      if (q) {
        const haystack = [
          r.nome_negocio,
          r.agente_ativacao,
          r.etapa_negocio,
          r.perfil_cliente,
          String(r.id_deal ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlyDivergentes) {
        const hasAsaas = (r.asaas_id?.trim() ?? "") !== "";
        if (!hasAsaas) return false;
        const delta = toNum(r.mrr_asaas) - toNum(r.mrr);
        if (Math.abs(delta) <= EPS_DIV) return false;
      }
      return true;
    });
  }, [rows, etapaSel, ativSel, perfilSel, bandKeys, busca, onlyDivergentes]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "nome":
          return dir * (a.nome_negocio ?? "").localeCompare(b.nome_negocio ?? "");
        case "etapa":
          return dir * (a.etapa_negocio ?? "").localeCompare(b.etapa_negocio ?? "");
        case "ativador":
          return dir * (a.agente_ativacao ?? "").localeCompare(b.agente_ativacao ?? "");
        case "perfil":
          return dir * perfilOf(a).localeCompare(perfilOf(b));
        case "criacao":
          return dir * (toNum(a.sla_dias_criacao) - toNum(b.sla_dias_criacao));
        case "mrr":
          return dir * (toNum(a.mrr) - toNum(b.mrr));
        case "mrrAsaas":
          return dir * (toNum(a.mrr_asaas) - toNum(b.mrr_asaas));
        case "delta":
          return dir * ((toNum(a.mrr_asaas) - toNum(a.mrr)) - (toNum(b.mrr_asaas) - toNum(b.mrr)));
        case "fase":
        default:
          return dir * (toNum(a.sla_dias_etapa) - toNum(b.sla_dias_etapa));
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(0);
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:text-primary"
    >
      {children}
      <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-primary" : "opacity-40")} />
    </button>
  );

  const clearAll = () => {
    setBandSel(new Set()); setEtapaSel(new Set());
    setAtivSel(new Set()); setPerfilSel(new Set()); setBusca("");
    setOnlyDivergentes(false);
    setPage(0);
  };
  const anyFilter = bandSel.size || etapaSel.size || ativSel.size || perfilSel.size || busca || onlyDivergentes;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div data-tour="deals-header" className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            Lista de deals
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {sorted.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} clientes
          </p>
        </div>
        <ExportCsvButton rows={sorted} filename="deals_filtrados" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(0); }}
            placeholder="Buscar (negócio, ativador, etapa…)"
            className="h-10 w-[220px] pl-8"
          />
        </div>
        <MultiSelectFilter
          label="Faixa SLA"
          options={bandOpts}
          selected={bandSel}
          onChange={(s) => { setBandSel(s); setPage(0); }}
        />
        <MultiSelectFilter
          label="Ocultar fase"
          options={etapaOpts}
          selected={etapaSel}
          onChange={(s) => { setEtapaSel(s); setPage(0); }}
        />
        {!hideAtivadorFilter && (
          <MultiSelectFilter
            label="Ativador"
            options={ativOpts}
            selected={ativSel}
            onChange={(s) => { setAtivSel(s); setPage(0); }}
          />
        )}
        <MultiSelectFilter
          label="Perfil"
          options={perfilOpts}
          selected={perfilSel}
          onChange={(s) => { setPerfilSel(s); setPage(0); }}
        />
        <button
          type="button"
          onClick={() => { setOnlyDivergentes((v) => !v); setPage(0); }}
          className={cn(
            "rounded-lg border px-3 py-2 font-subtitle text-xs transition",
            onlyDivergentes
              ? "border-secondary/60 bg-secondary/10 text-secondary"
              : "border-border text-muted-foreground hover:border-secondary/40 hover:text-secondary",
          )}
          title="Mostrar apenas deals em que MRR Hubspot difere do MRR Asaas"
        >
          Só divergentes (Hub × Asaas)
        </button>
        {anyFilter ? (
          <button
            onClick={clearAll}
            className="rounded-lg border border-border px-3 py-2 font-subtitle text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortBtn k="nome">Negócio</SortBtn></TableHead>
              <TableHead><SortBtn k="etapa">Etapa</SortBtn></TableHead>
              <TableHead className="text-right"><SortBtn k="criacao">SLA criação</SortBtn></TableHead>
              <TableHead className="text-right"><SortBtn k="fase">SLA fase</SortBtn></TableHead>
              <TableHead className="text-right"><SortBtn k="mrr">MRR Hub</SortBtn></TableHead>
              <TableHead className="text-right"><SortBtn k="mrrAsaas">MRR Asaas</SortBtn></TableHead>
              <TableHead className="text-right"><SortBtn k="delta">Δ</SortBtn></TableHead>
              {!hideAtivadorFilter && (
                <TableHead><SortBtn k="ativador">Ativador</SortBtn></TableHead>
              )}
              <TableHead><SortBtn k="perfil">Perfil</SortBtn></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={hideAtivadorFilter ? 8 : 9} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum deal encontrado.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => {
              const mrrHub = toNum(r.mrr);
              const mrrAsaas = toNum(r.mrr_asaas);
              const hasAsaas = (r.asaas_id?.trim() ?? "") !== "";
              const delta = mrrAsaas - mrrHub;
              const divergent = hasAsaas && Math.abs(delta) > EPS_DIV;
              return (
                <TableRow
                  key={r.id_deal}
                  onClick={() => openDeal(r)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium text-foreground">
                    {r.nome_negocio || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.etapa_negocio || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <BandPill dias={toNum(r.sla_dias_criacao)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <BandPill dias={toNum(r.sla_dias_etapa)} />
                  </TableCell>
                  <TableCell className="text-right font-numeric tabular-nums">
                    {mrrHub > 0 ? fmtBRL0(mrrHub) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-numeric tabular-nums">
                    {hasAsaas ? (
                      fmtBRL0(mrrAsaas)
                    ) : (
                      <span className="text-muted-foreground" title="Sem vínculo com Asaas">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-numeric font-semibold tabular-nums",
                      !hasAsaas && "text-muted-foreground",
                      divergent && delta >= 0 && "text-success",
                      divergent && delta < 0 && "text-destructive",
                    )}
                    title={hasAsaas ? "Asaas − Hubspot" : "Sem Asaas vinculado"}
                  >
                    {!hasAsaas ? "—" : divergent ? `${delta >= 0 ? "+" : ""}${fmtBRL0(delta)}` : "≈"}
                  </TableCell>
                  {!hideAtivadorFilter && (
                    <TableCell className="text-muted-foreground">
                      {r.agente_ativacao || "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-numeric text-xs">
                      {perfilOf(r)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-subtitle text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            {sorted.length === 0
              ? "0 resultados"
              : `${pageSafe * pageSize + 1}–${Math.min(sorted.length, (pageSafe + 1) * pageSize)} de ${sorted.length.toLocaleString("pt-BR")}`}
          </span>
          <span className="mx-1 text-border">·</span>
          <label className="flex items-center gap-1.5">
            Por página
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
            >
              {PAGE_SIZE_OPTS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={pageSafe === 0}
            className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
            aria-label="Primeira página"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageSafe === 0}
            className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
            aria-label="Página anterior"
          >
            <span className="hidden sm:inline">Anterior</span>
            <span className="sm:hidden">‹</span>
          </button>
          {(() => {
            const pages: number[] = [];
            const visible = 3;
            const start = Math.max(0, Math.min(pageSafe - Math.floor(visible / 2), totalPages - visible));
            const end = Math.min(totalPages, start + visible);
            for (let i = start; i < end; i++) pages.push(i);
            return pages.map((i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  "min-w-[34px] rounded-lg border px-2.5 py-1.5 tabular-nums",
                  i === pageSafe
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                {i + 1}
              </button>
            ));
          })()}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageSafe >= totalPages - 1}
            className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
            aria-label="Próxima página"
          >
            <span className="hidden sm:inline">Próxima</span>
            <span className="sm:hidden">›</span>
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={pageSafe >= totalPages - 1}
            className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40"
            aria-label="Última página"
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
};
