import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fmtBRL,
  parseDate,
  isChurnRow,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { hubspotDealUrl } from "@/lib/hubspot";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: DashRow[];
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const PERFIS_ORDER = ["P", "M", "G", "GG", "Isento"];
const PAGE_SIZE = 50;

type SortKey = "cliente" | "agente" | "perfil" | "etapa" | "mrr" | "data";

export const ChurnDetailModal = ({
  open,
  onOpenChange,
  rows,
  periodStart,
  periodEnd,
  periodLabel,
}: Props) => {
  const churn = useMemo(() => {
    return rows
      .map((row) => {
        if (!isChurnRow(row)) return null;
        const d = parseDate(row.data_fechamento);
        if (!d || d < periodStart || d >= periodEnd) return null;
        const perfilRaw = row.perfil_cliente?.trim() || "";
        const perfilKey = perfilRaw.split(/\s+/)[0]?.toUpperCase() || "—";
        return {
          id: row.id_deal,
          cliente: row.nome_negocio?.trim() || "—",
          agente: row.agente_ativacao?.trim() || "Sem responsável",
          perfil: perfilKey === "ISENTO" ? "Isento" : perfilKey,
          etapa: row.etapa_negocio?.trim() || "—",
          mrr: toNum(row.mrr),
          dataStr: d.toLocaleDateString("pt-BR"),
          dataObj: d,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [rows, periodStart, periodEnd]);

  const totalMrr = churn.reduce((s, x) => s + x.mrr, 0);
  const totalQtd = churn.length;
  const ticketMedio = totalQtd > 0 ? totalMrr / totalQtd : 0;

  const porAgente = useMemo(() => {
    const map = new Map<string, { qtd: number; mrr: number }>();
    for (const a of churn) {
      const cur = map.get(a.agente) ?? { qtd: 0, mrr: 0 };
      cur.qtd += 1;
      cur.mrr += a.mrr;
      map.set(a.agente, cur);
    }
    return [...map.entries()]
      .map(([nome, v]) => ({
        nome,
        ...v,
        pct: totalMrr > 0 ? (v.mrr / totalMrr) * 100 : 0,
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [churn, totalMrr]);

  const porPerfil = useMemo(() => {
    const map = new Map<string, { qtd: number; mrr: number }>();
    for (const a of churn) {
      const cur = map.get(a.perfil) ?? { qtd: 0, mrr: 0 };
      cur.qtd += 1;
      cur.mrr += a.mrr;
      map.set(a.perfil, cur);
    }
    const known = PERFIS_ORDER.map((p) => {
      const v = map.get(p) ?? { qtd: 0, mrr: 0 };
      map.delete(p);
      return { perfil: p, ...v, pct: totalMrr > 0 ? (v.mrr / totalMrr) * 100 : 0 };
    });
    const extra = [...map.entries()].map(([perfil, v]) => ({
      perfil,
      ...v,
      pct: totalMrr > 0 ? (v.mrr / totalMrr) * 100 : 0,
    }));
    return [...known, ...extra];
  }, [churn, totalMrr]);

  const maxPerfilMrr = Math.max(1, ...porPerfil.map((p) => p.mrr));

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? churn.filter(
          (a) =>
            a.cliente.toLowerCase().includes(term) ||
            a.agente.toLowerCase().includes(term) ||
            a.etapa.toLowerCase().includes(term),
        )
      : churn;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortKey === "data") {
        va = a.dataObj.getTime();
        vb = b.dataObj.getTime();
      } else {
        va = a[sortKey] as string | number;
        vb = b[sortKey] as string | number;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [churn, q, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(
        k === "cliente" || k === "agente" || k === "perfil" || k === "etapa" ? "asc" : "desc",
      );
    }
    setPage(0);
  };

  const Th = ({
    k,
    children,
    className,
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      onClick={() => toggleSort(k)}
      className={cn("cursor-pointer select-none hover:text-foreground", className)}
    >
      {children}
      {sortKey === k && <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </TableHead>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto sm:rounded-2xl rounded-none w-[100vw] sm:w-auto h-[100vh] sm:h-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Churn · {periodLabel}</DialogTitle>
          <DialogDescription>
            Deals em Pré-Churn, Churn (Sucesso) e Cancelamento (Onboarding) fechados no período
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR perdido
            </p>
            <p className="mt-2 font-numeric text-2xl font-bold text-destructive">
              {fmtBRL(totalMrr)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Deals
            </p>
            <p className="mt-2 font-numeric text-2xl font-bold text-foreground">
              {totalQtd.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Ticket médio
            </p>
            <p className="mt-2 font-numeric text-2xl font-bold text-foreground">
              {fmtBRL(ticketMedio)}
            </p>
          </div>
        </div>

        {/* Por agente */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <h3 className="font-display text-sm font-semibold text-secondary">Quebra por agente</h3>
          </div>
          <div className="max-h-[260px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">% do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porAgente.map((a) => (
                  <TableRow key={a.nome}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell className="text-right font-numeric tabular-nums">{a.qtd}</TableCell>
                    <TableCell className="text-right font-numeric tabular-nums">
                      {fmtBRL(a.mrr)}
                    </TableCell>
                    <TableCell className="text-right font-numeric tabular-nums text-muted-foreground">
                      {a.pct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {porAgente.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhum churn no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Por perfil */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-secondary">Quebra por perfil</h3>
          <div className="space-y-2">
            {porPerfil.map((p) => (
              <div key={p.perfil} className="flex items-center gap-3">
                <span className="w-12 font-subtitle text-xs font-semibold text-foreground">
                  {p.perfil}
                </span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full bg-destructive/70 transition-all"
                    style={{ width: `${(p.mrr / maxPerfilMrr) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right font-numeric text-xs tabular-nums text-muted-foreground">
                  {p.qtd}
                </span>
                <span className="w-28 text-right font-numeric text-xs font-semibold tabular-nums">
                  {fmtBRL(p.mrr)}
                </span>
                <span className="w-14 text-right font-numeric text-xs tabular-nums text-muted-foreground">
                  {p.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de deals */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-secondary">
              Deals em churn ({filtered.length.toLocaleString("pt-BR")})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar cliente, agente ou etapa…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <Th k="cliente">Cliente</Th>
                  <Th k="agente">Agente</Th>
                  <Th k="perfil">Perfil</Th>
                  <Th k="etapa">Etapa</Th>
                  <Th k="mrr" className="text-right">MRR</Th>
                  <Th k="data">Fechamento</Th>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{row.agente}</TableCell>
                    <TableCell className="text-muted-foreground">{row.perfil}</TableCell>
                    <TableCell className="text-muted-foreground">{row.etapa}</TableCell>
                    <TableCell className="text-right font-numeric tabular-nums">
                      {fmtBRL(row.mrr)}
                    </TableCell>
                    <TableCell className="font-numeric tabular-nums text-muted-foreground">
                      {row.dataStr || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={hubspotDealUrl(row.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-subtitle text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        HubSpot <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum churn encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="font-small text-xs text-muted-foreground">
                Página {pageSafe + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={pageSafe === 0}
                  className="rounded-md border border-border px-3 py-1 font-subtitle text-xs transition hover:border-primary/40 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={pageSafe >= totalPages - 1}
                  className="rounded-md border border-border px-3 py-1 font-subtitle text-xs transition hover:border-primary/40 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
