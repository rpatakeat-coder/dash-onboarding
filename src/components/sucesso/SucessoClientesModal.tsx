import { useMemo, useState } from "react";
import { Search, ArrowUpDown, ExternalLink } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { hubspotDealUrl } from "@/lib/hubspot";
import { fmtBRL, type DashSucessoRow } from "@/hooks/useDashSucesso";
import { DataCard, DataCardHeader, DataCardRow } from "@/components/ui/DataCard";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  rows: DashSucessoRow[];
  /** Exibe a coluna "Fechado em" (usado no churn). */
  showFechado?: boolean;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// data_fechamento vem como string BR "DD/MM/YYYY HH:MM:SS".
const fmtFechado = (s: string | null | undefined): string => {
  if (!s) return "—";
  const str = s.trim();
  if (str.includes("/")) return str.split(" ")[0];
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

type SortKey = "cliente" | "mrr";

export const SucessoClientesModal = ({ open, onOpenChange, title, description, rows, showFechado }: Props) => {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mrr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!term) return true;
      const cliente = (r.nome_negocio ?? "").toLowerCase();
      const agente = (r.agente_sucesso ?? "").toLowerCase();
      const etapa = (r.etapa_negocio ?? "").toLowerCase();
      return cliente.includes(term) || agente.includes(term) || etapa.includes(term);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "mrr") return (num(a.mrr) - num(b.mrr)) * dir;
      return (a.nome_negocio ?? "").localeCompare(b.nome_negocio ?? "") * dir;
    });
  }, [rows, q, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "cliente" ? "asc" : "desc");
    }
  };

  const totalMrr = useMemo(() => list.reduce((s, r) => s + num(r.mrr), 0), [list]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {list.length.toLocaleString("pt-BR")} cliente{list.length === 1 ? "" : "s"} · {fmtBRL(totalMrr)} em MRR
            {description ? ` · ${description}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, agente ou etapa…"
            className="pl-9"
          />
        </div>

        <div className="hidden max-h-[60vh] overflow-auto rounded-lg border md:block">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead
                  onClick={() => toggleSort("cliente")}
                  className="cursor-pointer select-none hover:text-foreground"
                >
                  Cliente {sortKey === "cliente" && <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Agente de Sucesso</TableHead>
                <TableHead>Etapa</TableHead>
                {showFechado && <TableHead className="text-right">Fechado em</TableHead>}
                <TableHead
                  onClick={() => toggleSort("mrr")}
                  className="cursor-pointer select-none text-right hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1">MRR <ArrowUpDown className="h-3 w-3" /></span>
                  {sortKey === "mrr" && <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r, i) => (
                <TableRow key={`${r.id_deal}-${i}`}>
                  <TableCell className="font-medium">
                    <a
                      href={hubspotDealUrl(r.id_deal)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/hs inline-flex items-center gap-1 text-foreground transition hover:text-primary hover:underline"
                      title="Abrir no HubSpot"
                    >
                      {r.nome_negocio ?? "—"}
                      <ExternalLink className="h-3 w-3 text-muted-foreground transition group-hover/hs:text-primary" />
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.perfil_cliente ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.agente_sucesso?.trim() || "Sem responsável"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.etapa_negocio ?? "—"}</TableCell>
                  {showFechado && (
                    <TableCell className="text-right font-numeric tabular-nums text-muted-foreground">
                      {fmtFechado(r.data_fechamento)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-numeric font-semibold tabular-nums">
                    {fmtBRL(num(r.mrr))}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showFechado ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: cards */}
        <div className="max-h-[60vh] space-y-2 overflow-auto md:hidden">
          {list.map((r, i) => (
            <DataCard key={`${r.id_deal}-m-${i}`}>
              <DataCardHeader right={<span className="font-numeric text-sm font-semibold text-foreground">{fmtBRL(num(r.mrr))}</span>}>
                <a
                  href={hubspotDealUrl(r.id_deal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/hs inline-flex items-center gap-1 text-foreground transition hover:text-primary hover:underline"
                  title="Abrir no HubSpot"
                >
                  {r.nome_negocio ?? "—"}
                  <ExternalLink className="h-3 w-3 text-muted-foreground transition group-hover/hs:text-primary" />
                </a>
              </DataCardHeader>
              <DataCardRow label="Perfil">{r.perfil_cliente ?? "—"}</DataCardRow>
              <DataCardRow label="Agente">{r.agente_sucesso?.trim() || "Sem responsável"}</DataCardRow>
              <DataCardRow label="Etapa">{r.etapa_negocio ?? "—"}</DataCardRow>
              {showFechado && <DataCardRow label="Fechado em">{fmtFechado(r.data_fechamento)}</DataCardRow>}
            </DataCard>
          ))}
          {list.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
