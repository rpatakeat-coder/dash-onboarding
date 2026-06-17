import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, DollarSign, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/hooks/useDashSucesso";

type UpsellRow = Database["public"]["Tables"]["dash_upsell"]["Row"];

const ALL = "__all__";
const PAGE_SIZE_OPTS = [25, 50, 75, 100] as const;

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const txt = (v: unknown): string => (v == null ? "" : String(v).trim());

// MRR efetivo: se a coluna mrr estiver vazia, usa valor_avulso.
const mrrOf = (r: UpsellRow): number => {
  const vazio = r.mrr == null || String(r.mrr).trim() === "";
  return num(vazio ? r.valor_avulso : r.mrr);
};

// `data` pode vir como BR "DD/MM/YYYY [hh:mm]" ou ISO.
const fmtData = (s: string | null | undefined): string => {
  const str = txt(s);
  if (!str) return "—";
  if (str.includes("/")) return str.split(" ")[0];
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString("pt-BR");
};
const dataToTs = (s: string | null | undefined): number => {
  const str = txt(s);
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const fetchUpsell = async (): Promise<UpsellRow[]> => {
  const pageSize = 1000;
  let from = 0;
  const all: UpsellRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("dash_upsell")
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as UpsellRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

type SortKey = "data" | "mrr";

const Filtro = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL}>{label}: todos</SelectItem>
      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const UpsellSucesso = () => {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["dash_upsell"],
    queryFn: fetchUpsell,
    staleTime: 5 * 60 * 1000,
  });

  const [q, setQ] = useState("");
  const [vendedor, setVendedor] = useState(ALL);
  const [forma, setForma] = useState(ALL);
  const [periodo, setPeriodo] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTS[0]);

  const opts = (sel: (r: UpsellRow) => unknown) =>
    Array.from(new Set(rows.map((r) => txt(sel(r))).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const vendedoresOpts = useMemo(() => opts((r) => r.vendedor), [rows]);
  const formasOpts = useMemo(() => opts((r) => r.forma_pagamento), [rows]);
  const periodosOpts = useMemo(() => opts((r) => r.periodo), [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (vendedor !== ALL && txt(r.vendedor) !== vendedor) return false;
      if (forma !== ALL && txt(r.forma_pagamento) !== forma) return false;
      if (periodo !== ALL && txt(r.periodo) !== periodo) return false;
      if (term) {
        const hay = [r.cliente, r.vendedor, r.adicionais, r.forma_pagamento, r.periodo].map(txt).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, vendedor, forma, periodo]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sortKey === "mrr" ? (mrrOf(a) - mrrOf(b)) * dir : (dataToTs(a.data) - dataToTs(b.data)) * dir,
    );
  }, [filtered, sortKey, sortDir]);

  const totalMrr = useMemo(() => filtered.reduce((s, r) => s + mrrOf(r), 0), [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);
  useEffect(() => { setPage(0); }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const hasFilter = q.trim() !== "" || vendedor !== ALL || forma !== ALL || periodo !== ALL;
  const clear = () => { setQ(""); setVendedor(ALL); setForma(ALL); setPeriodo(ALL); };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">Upsell</h2>
          <p className="font-small text-xs text-muted-foreground">Vendas de upsell do time (tabela dash_upsell)</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Erro ao carregar upsell: {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Upsells" value={isLoading ? "—" : filtered.length.toLocaleString("pt-BR")} icon={TrendingUp} tone="success" hint="qtd. de vendas de upsell (filtros aplicados)" />
        <KpiCard label="MRR de Upsell" value={isLoading ? "—" : fmtBRL(totalMrr)} icon={DollarSign} tone="success" hint="soma do MRR dos upsells filtrados" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, vendedor, adicionais…" className="pl-9" />
        </div>
        <Filtro label="Vendedor" value={vendedor} onChange={setVendedor} options={vendedoresOpts} />
        <Filtro label="Forma pgto" value={forma} onChange={setForma} options={formasOpts} />
        <Filtro label="Período" value={periodo} onChange={setPeriodo} options={periodosOpts} />
        {hasFilter && (
          <button onClick={clear} className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Limpar</button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Vendedor</th>
              <th className="px-3 py-2 text-right">
                <button type="button" onClick={() => toggleSort("mrr")} className="inline-flex items-center transition hover:text-foreground">MRR{arrow("mrr")}</button>
              </th>
              <th className="px-3 py-2 text-left">Forma de pagamento</th>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-left">Adicionais</th>
              <th className="px-3 py-2 text-right">
                <button type="button" onClick={() => toggleSort("data")} className="inline-flex items-center transition hover:text-foreground">Data{arrow("data")}</button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((r, i) => (
              <tr key={`${txt(r.cliente)}-${pageSafe * pageSize + i}`} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium text-foreground">{txt(r.cliente) || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{txt(r.vendedor) || "—"}</td>
                <td className="px-3 py-2.5 text-right font-numeric font-semibold tabular-nums">{fmtBRL(mrrOf(r))}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{txt(r.forma_pagamento) || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{txt(r.periodo) || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{txt(r.adicionais) || "—"}</td>
                <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtData(r.data)}</td>
              </tr>
            ))}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum upsell encontrado.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 font-subtitle text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{`${pageSafe * pageSize + 1}–${Math.min(sorted.length, (pageSafe + 1) * pageSize)} de ${sorted.length.toLocaleString("pt-BR")}`}</span>
            <span className="mx-1 text-border">·</span>
            <label className="flex items-center gap-1.5">
              Por página
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
                {PAGE_SIZE_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button onClick={() => setPage(0)} disabled={pageSafe === 0} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Primeira página">«</button>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={pageSafe === 0} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40">
              <span className="hidden sm:inline">Anterior</span><span className="sm:hidden">‹</span>
            </button>
            {(() => {
              const pages: number[] = [];
              const visible = 3;
              const start = Math.max(0, Math.min(pageSafe - Math.floor(visible / 2), totalPages - visible));
              const end = Math.min(totalPages, start + visible);
              for (let i = start; i < end; i++) pages.push(i);
              return pages.map((i) => (
                <button key={i} onClick={() => setPage(i)} className={cn("min-w-[34px] rounded-lg border px-2.5 py-1.5 tabular-nums", i === pageSafe ? "border-primary/60 bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>{i + 1}</button>
              ));
            })()}
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40">
              <span className="hidden sm:inline">Próxima</span><span className="sm:hidden">›</span>
            </button>
            <button onClick={() => setPage(totalPages - 1)} disabled={pageSafe >= totalPages - 1} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Última página">»</button>
          </div>
        </div>
      )}
    </section>
  );
};
