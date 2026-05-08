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
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL, type DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: DashRow[];
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type SortKey = "cliente" | "etapa" | "ativador" | "sla" | "mrr";

const slaTone = (d: number) => {
  if (d > 30) return "text-destructive font-semibold";
  if (d > 7) return "text-warning font-semibold";
  return "text-success";
};

export const EstoqueModal = ({ open, onOpenChange, rows }: Props) => {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sla");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const mapped = rows.map((r) => ({
      id: r.id_deal,
      cliente: r.nome_negocio?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      ativador: r.agente_ativacao?.trim() || "—",
      perfil: r.perfil_cliente?.trim() || "—",
      sla: toNum(r.sla_dias),
      mrr: toNum(r.mrr),
    }));
    const filtered = term
      ? mapped.filter(
          (r) =>
            r.cliente.toLowerCase().includes(term) ||
            r.etapa.toLowerCase().includes(term) ||
            r.ativador.toLowerCase().includes(term),
        )
      : mapped;
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, q, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "cliente" || k === "etapa" || k === "ativador" ? "asc" : "desc");
    }
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Estoque · Clientes em onboarding</DialogTitle>
          <DialogDescription>
            {list.length.toLocaleString("pt-BR")} clientes · ordenados por SLA na fase atual
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, etapa ou ativador…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <Th k="cliente">Cliente</Th>
                <Th k="etapa">Etapa</Th>
                <Th k="ativador">Ativador</Th>
                <Th k="sla" className="text-right">SLA (dias)</Th>
                <Th k="mrr" className="text-right">MRR</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.cliente}</TableCell>
                  <TableCell className="text-muted-foreground">{r.etapa}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ativador}</TableCell>
                  <TableCell className={cn("text-right font-numeric tabular-nums", slaTone(r.sla))}>
                    {r.sla.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right font-numeric tabular-nums">
                    {r.mrr ? fmtBRL(r.mrr) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
