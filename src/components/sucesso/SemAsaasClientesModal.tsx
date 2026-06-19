import { useMemo, useState } from "react";
import { Search, ExternalLink, ArrowUpDown, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { hubspotDealUrl } from "@/lib/hubspot";
import { fmtBRL, type DashSucessoRow } from "@/hooks/useDashSucesso";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Clientes sem asaas_id (já recortados pelos filtros compartilhados da página). */
  rows: DashSucessoRow[];
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Sentinela do Select para "sem filtro" (Radix não aceita value="" em SelectItem).
const ALL = "__all__";
const SEM_AGENTE = "Sem responsável";

type SortKey = "cliente" | "mrr";

export const SemAsaasClientesModal = ({ open, onOpenChange, rows }: Props) => {
  const [q, setQ] = useState("");
  const [etapa, setEtapa] = useState<string>(ALL);
  const [agente, setAgente] = useState<string>(ALL);
  const [perfil, setPerfil] = useState<string>(ALL);
  const [mrrMin, setMrrMin] = useState("");
  const [mrrMax, setMrrMax] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mrr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Opções distintas derivadas dos dados.
  const etapaOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.etapa_negocio?.trim()).filter((e): e is string => !!e))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );
  const agenteOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.agente_sucesso?.trim() || SEM_AGENTE))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const perfilOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.perfil_cliente?.trim()).filter((p): p is string => !!p))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const min = mrrMin.trim() === "" ? null : num(mrrMin);
  const max = mrrMax.trim() === "" ? null : num(mrrMax);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (etapa !== ALL && (r.etapa_negocio?.trim() || "") !== etapa) return false;
      if (agente !== ALL && (r.agente_sucesso?.trim() || SEM_AGENTE) !== agente) return false;
      if (perfil !== ALL && (r.perfil_cliente?.trim() || "") !== perfil) return false;
      const m = num(r.mrr);
      if (min != null && m < min) return false;
      if (max != null && m > max) return false;
      if (term) {
        const cliente = (r.nome_negocio ?? "").toLowerCase();
        const ag = (r.agente_sucesso ?? "").toLowerCase();
        const et = (r.etapa_negocio ?? "").toLowerCase();
        if (!cliente.includes(term) && !ag.includes(term) && !et.includes(term)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "mrr") return (num(a.mrr) - num(b.mrr)) * dir;
      return (a.nome_negocio ?? "").localeCompare(b.nome_negocio ?? "") * dir;
    });
  }, [rows, q, etapa, agente, perfil, min, max, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "cliente" ? "asc" : "desc");
    }
  };

  const totalMrr = useMemo(() => list.reduce((s, r) => s + num(r.mrr), 0), [list]);
  const hasFiltro = etapa !== ALL || agente !== ALL || perfil !== ALL || min != null || max != null || q.trim() !== "";
  const limpar = () => {
    setQ("");
    setEtapa(ALL);
    setAgente(ALL);
    setPerfil(ALL);
    setMrrMin("");
    setMrrMax("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Clientes sem Asaas ID</DialogTitle>
          <DialogDescription>
            {list.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} cliente
            {rows.length === 1 ? "" : "s"} · {fmtBRL(totalMrr)} em MRR · cobrança Asaas não vinculada
          </DialogDescription>
        </DialogHeader>

        {/* Busca + filtros internos */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cliente, agente ou etapa…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={etapa} onValueChange={setEtapa}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as etapas</SelectItem>
                {etapaOptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={agente} onValueChange={setAgente}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os agentes</SelectItem>
                {agenteOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os perfis</SelectItem>
                {perfilOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              inputMode="numeric"
              value={mrrMin}
              onChange={(e) => setMrrMin(e.target.value)}
              placeholder="MRR mín"
              className="w-[120px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={mrrMax}
              onChange={(e) => setMrrMax(e.target.value)}
              placeholder="MRR máx"
              className="w-[120px]"
            />

            {hasFiltro && (
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-lg border">
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
                <TableHead>Pipeline</TableHead>
                <TableHead
                  onClick={() => toggleSort("mrr")}
                  className="cursor-pointer select-none text-right hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1">
                    MRR <ArrowUpDown className="h-3 w-3" />
                  </span>
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
                  <TableCell className="text-muted-foreground">{r.agente_sucesso?.trim() || SEM_AGENTE}</TableCell>
                  <TableCell className="text-muted-foreground">{r.etapa_negocio ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.pipeline_nome ?? "—"}</TableCell>
                  <TableCell className="text-right font-numeric font-semibold tabular-nums">
                    {fmtBRL(num(r.mrr))}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado com os filtros atuais.
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
