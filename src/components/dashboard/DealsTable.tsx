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

type SortKey = "nome" | "etapa" | "criacao" | "fase" | "ativador" | "perfil";
type SortDir = "asc" | "desc";

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

const PAGE_SIZE = 50;

export const DealsTable = ({ rows, hideAtivadorFilter }: Props) => {
  const { open: openDeal } = useDealDrawer();
  const [bandSel, setBandSel] = useState<Set<string>>(new Set());
  const [etapaSel, setEtapaSel] = useState<Set<string>>(new Set());
  const [ativSel, setAtivSel] = useState<Set<string>>(new Set());
  const [perfilSel, setPerfilSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fase");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const etapaOpts = useMemo(
    () => [...new Set(rows.map((r) => r.etapa_negocio?.trim() || "Sem etapa"))],
    [rows],
  );
  const ativOpts = useMemo(
    () => [...new Set(rows.map((r) => r.agente_ativacao?.trim() || "Sem responsável"))],
    [rows],
  );
  const perfilOpts = useMemo(
    () => [...new Set(rows.map(perfilOf))].sort(),
    [rows],
  );
  const bandOpts = useMemo(() => BAND_ORDER.map(bandLabel), []);

  const bandKeys = useMemo(() => new Set([...bandSel].map(bandFromLabel)), [bandSel]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (etapaSel.size && !etapaSel.has(r.etapa_negocio?.trim() || "Sem etapa")) return false;
      if (ativSel.size && !ativSel.has(r.agente_ativacao?.trim() || "Sem responsável")) return false;
      if (perfilSel.size && !perfilSel.has(perfilOf(r))) return false;
      if (bandKeys.size && !bandKeys.has(slaBand(toNum(r.sla_dias_etapa)))) return false;
      if (q && !(r.nome_negocio?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, etapaSel, ativSel, perfilSel, bandKeys, busca]);

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
        case "fase":
        default:
          return dir * (toNum(a.sla_dias_etapa) - toNum(b.sla_dias_etapa));
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(0);
  };

  const csvRows = useMemo(
    () =>
      sorted.map((r) => ({
        nome: r.nome_negocio ?? "",
        etapa: r.etapa_negocio ?? "",
        sla_criacao: toNum(r.sla_dias_criacao),
        sla_fase: toNum(r.sla_dias_etapa),
        ativador: r.agente_ativacao ?? "",
        perfil: perfilOf(r),
        mrr: toNum(r.mrr),
      })),
    [sorted],
  );

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
    setPage(0);
  };
  const anyFilter = bandSel.size || etapaSel.size || ativSel.size || perfilSel.size || busca;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            Lista de deals
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {sorted.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} clientes
          </p>
        </div>
        <ExportCsvButton
          rows={csvRows as unknown as Record<string, unknown>[]}
          filename="deals_filtrados.csv"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(0); }}
            placeholder="Buscar negócio…"
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
          label="Fase"
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
              {!hideAtivadorFilter && (
                <TableHead><SortBtn k="ativador">Ativador</SortBtn></TableHead>
              )}
              <TableHead><SortBtn k="perfil">Perfil</SortBtn></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={hideAtivadorFilter ? 5 : 6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum deal encontrado.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
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
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2 font-subtitle text-xs text-muted-foreground">
          <span>
            Página {pageSafe + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/40 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={pageSafe >= totalPages - 1}
              className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/40 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
