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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const PERFIS_PADRAO = ["P", "M", "G", "GG"];

export const EstoqueModal = ({ open, onOpenChange, rows }: Props) => {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sla");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [perfilSel, setPerfilSel] = useState<Set<string>>(new Set());
  const [etapaSel, setEtapaSel] = useState<Set<string>>(new Set());

  const mapped = useMemo(
    () =>
      rows.map((r) => {
        const perfilRaw = r.perfil_cliente?.trim() || "";
        const perfilKey = perfilRaw.split(/\s+/)[0]?.toUpperCase() || "—";
        return {
          id: r.id_deal,
          cliente: r.nome_negocio?.trim() || "—",
          etapa: r.etapa_negocio?.trim() || "—",
          ativador: r.agente_ativacao?.trim() || "—",
          perfil: perfilKey,
          sla: toNum(r.sla_dias),
          mrr: toNum(r.mrr),
        };
      }),
    [rows],
  );

  const perfisDisponiveis = useMemo(() => {
    const set = new Set(mapped.map((r) => r.perfil));
    const known = PERFIS_PADRAO.filter((p) => set.has(p));
    const extra = [...set].filter((p) => !PERFIS_PADRAO.includes(p)).sort();
    return [...known, ...extra];
  }, [mapped]);

  const etapasDisponiveis = useMemo(
    () => [...new Set(mapped.map((r) => r.etapa))].sort(),
    [mapped],
  );

  // Counts respect search + the OTHER dimension's selection (not the dimension itself)
  const term = q.trim().toLowerCase();
  const matchesSearch = (r: (typeof mapped)[number]) =>
    !term ||
    r.cliente.toLowerCase().includes(term) ||
    r.etapa.toLowerCase().includes(term) ||
    r.ativador.toLowerCase().includes(term);

  const perfilCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of mapped) {
      if (!matchesSearch(r)) continue;
      if (etapaSel.size && !etapaSel.has(r.etapa)) continue;
      counts[r.perfil] = (counts[r.perfil] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, etapaSel, q]);

  const etapaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of mapped) {
      if (!matchesSearch(r)) continue;
      if (perfilSel.size && !perfilSel.has(r.perfil)) continue;
      counts[r.etapa] = (counts[r.etapa] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, perfilSel, q]);

  const perfisOrdenados = useMemo(
    () => [...perfisDisponiveis].sort((a, b) => (perfilCounts[b] ?? 0) - (perfilCounts[a] ?? 0)),
    [perfisDisponiveis, perfilCounts],
  );
  const etapasOrdenadas = useMemo(
    () =>
      [...etapasDisponiveis].sort(
        (a, b) => (etapaCounts[b] ?? 0) - (etapaCounts[a] ?? 0) || a.localeCompare(b),
      ),
    [etapasDisponiveis, etapaCounts],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = mapped.filter((r) => {
      if (perfilSel.size && !perfilSel.has(r.perfil)) return false;
      if (etapaSel.size && !etapaSel.has(r.etapa)) return false;
      if (
        term &&
        !r.cliente.toLowerCase().includes(term) &&
        !r.etapa.toLowerCase().includes(term) &&
        !r.ativador.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [mapped, q, sortKey, sortDir, perfilSel, etapaSel]);

  const togglePerfil = (p: string) => {
    setPerfilSel((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  };
  const toggleEtapa = (e: string) => {
    setEtapaSel((s) => {
      const n = new Set(s);
      n.has(e) ? n.delete(e) : n.add(e);
      return n;
    });
  };
  const clearFilters = () => {
    setPerfilSel(new Set());
    setEtapaSel(new Set());
    setQ("");
  };
  const hasFilters = perfilSel.size > 0 || etapaSel.size > 0 || q.length > 0;

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

        <TooltipProvider delayDuration={150}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Perfil
            </span>
            {perfisOrdenados.map((p) => {
              const active = perfilSel.has(p);
              const count = perfilCounts[p] ?? 0;
              const disabled = count === 0 && !active;
              const criterios: string[] = [];
              if (q.trim()) criterios.push(`busca "${q.trim()}"`);
              if (etapaSel.size) criterios.push(`etapas: ${[...etapaSel].join(", ")}`);
              const resumo = criterios.length
                ? `Considerando: ${criterios.join(" + ")}`
                : "Sem outros filtros aplicados";
              return (
                <Tooltip key={p}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => togglePerfil(p)}
                      disabled={disabled}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 font-subtitle text-xs font-semibold transition",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        disabled && "opacity-40 hover:border-border hover:text-muted-foreground",
                      )}
                    >
                      <span>{p}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-numeric text-[10px] font-bold tabular-nums",
                          active ? "bg-primary-foreground/20" : "bg-muted text-foreground/70",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    <p className="font-subtitle text-xs font-semibold">
                      Perfil {p} · {count} cliente{count === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 font-small text-[11px] text-muted-foreground">{resumo}</p>
                    {active && (
                      <p className="mt-1 font-small text-[11px] text-primary">Filtro ativo — clique para remover</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Etapa
            </span>
            {etapasOrdenadas.map((e) => {
              const active = etapaSel.has(e);
              const count = etapaCounts[e] ?? 0;
              const disabled = count === 0 && !active;
              const criterios: string[] = [];
              if (q.trim()) criterios.push(`busca "${q.trim()}"`);
              if (perfilSel.size) criterios.push(`perfis: ${[...perfilSel].join(", ")}`);
              const resumo = criterios.length
                ? `Considerando: ${criterios.join(" + ")}`
                : "Sem outros filtros aplicados";
              return (
                <Tooltip key={e}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleEtapa(e)}
                      disabled={disabled}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 font-subtitle text-xs font-medium transition",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        disabled && "opacity-40 hover:border-border hover:text-muted-foreground",
                      )}
                    >
                      <span>{e}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-numeric text-[10px] font-bold tabular-nums",
                          active ? "bg-primary-foreground/20" : "bg-muted text-foreground/70",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="font-subtitle text-xs font-semibold">
                      {e} · {count} cliente{count === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 font-small text-[11px] text-muted-foreground">{resumo}</p>
                    {active && (
                      <p className="mt-1 font-small text-[11px] text-primary">Filtro ativo — clique para remover</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto rounded-full px-3 py-1 font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        </TooltipProvider>

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
                  <TableCell className="font-medium"><DealLink id={r.id}>{r.cliente}</DealLink></TableCell>
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
