import { useEffect, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import {
  TrendingDown,
  Users,
  DollarSign,
  UserCheck,
  Building2,
  ListChecks,
  User as UserIcon,
  ExternalLink,
  Search,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RefreshDataButton } from "@/components/dashboard/RefreshDataButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  useDashSucesso,
  fmtBRL,
  fmtPct,
  grupoPerfil,
  type DashSucessoRow,
} from "@/hooks/useDashSucesso";
import { hubspotDealUrl } from "@/lib/hubspot";
import { cn } from "@/lib/utils";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

// data_fechamento é string BR "DD/MM/YYYY HH:MM:SS". Casa pelo mês/ano (LIKE '%/MM/YYYY %').
const matchPeriodo = (s: string | null | undefined, month0: number, year: number): boolean => {
  if (!s) return false;
  const str = s.trim();
  const mm = String(month0 + 1).padStart(2, "0");
  if (str.includes("/")) return str.includes(`/${mm}/${year}`);
  const d = new Date(str);
  return !Number.isNaN(d.getTime()) && d.getMonth() === month0 && d.getFullYear() === year;
};
const fmtFechado = (s: string | null | undefined): string => {
  if (!s) return "—";
  const str = s.trim();
  if (str.includes("/")) return str.split(" ")[0];
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

// Motivos de churn ficam em 3 colunas (n1/n2/n3); junta os preenchidos.
const motivosOf = (r: DashSucessoRow): string[] =>
  [r.motivo_n1, r.motivo_n2, r.motivo_n3]
    .map((m) => m?.trim())
    .filter((m): m is string => !!m);

// Motivos por nível (N1/N2/N3) ou todos.
type Nivel = "n1" | "n2" | "n3" | "todos";
const NIVEL_LABEL: Record<Nivel, string> = { n1: "N1", n2: "N2", n3: "N3", todos: "N1/N2/N3" };
const motivosForNivel = (r: DashSucessoRow, nivel: Nivel): string[] => {
  if (nivel === "todos") return motivosOf(r);
  const v = (nivel === "n1" ? r.motivo_n1 : nivel === "n2" ? r.motivo_n2 : r.motivo_n3)?.trim();
  return v ? [v] : [];
};

const ALL = "__all__";
const PAGE_SIZE_OPTS = [25, 50, 75, 100] as const;

// Ordem de perfil: P (menor) < M < G < GG (maior).
const PERFIL_ORDER: Record<string, number> = { P: 1, M: 2, G: 3, GG: 4 };
const perfilRank = (p: string | null | undefined) => PERFIL_ORDER[(p ?? "").trim().toUpperCase()] ?? 0;

interface ChurnStats {
  qtd: number;
  mrr: number;
  qtdPM: number;
  qtdGGG: number;
  mrrPM: number;
  mrrGGG: number;
}
const computeStats = (rows: DashSucessoRow[]): ChurnStats => {
  let qtd = 0, mrr = 0, qtdPM = 0, qtdGGG = 0, mrrPM = 0, mrrGGG = 0;
  for (const r of rows) {
    const m = num(r.mrr);
    qtd++; mrr += m;
    const g = grupoPerfil(r.perfil_cliente);
    if (g === "P+M") { qtdPM++; mrrPM += m; }
    else if (g === "G+GG") { qtdGGG++; mrrGGG += m; }
  }
  return { qtd, mrr, qtdPM, qtdGGG, mrrPM, mrrGGG };
};

// ---- Subcomponentes ----
// Barra de paginação reutilizável (25/50/75/100).
const PaginationBar = ({ total, page, pageSize, totalPages, setPage, setPageSize }: {
  total: number; page: number; pageSize: number; totalPages: number;
  setPage: Dispatch<SetStateAction<number>>; setPageSize: Dispatch<SetStateAction<number>>;
}) => {
  const pages: number[] = [];
  const visible = 3;
  const start = Math.max(0, Math.min(page - Math.floor(visible / 2), totalPages - visible));
  const end = Math.min(totalPages, start + visible);
  for (let i = start; i < end; i++) pages.push(i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 font-subtitle text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>{`${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} de ${total.toLocaleString("pt-BR")}`}</span>
        <span className="mx-1 text-border">·</span>
        <label className="flex items-center gap-1.5">
          Por página
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(() => 0); }}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          >
            {PAGE_SIZE_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button onClick={() => setPage(() => 0)} disabled={page === 0} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Primeira página">«</button>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Página anterior">
          <span className="hidden sm:inline">Anterior</span><span className="sm:hidden">‹</span>
        </button>
        {pages.map((i) => (
          <button key={i} onClick={() => setPage(() => i)} className={cn("min-w-[34px] rounded-lg border px-2.5 py-1.5 tabular-nums", i === page ? "border-primary/60 bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>{i + 1}</button>
        ))}
        <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Próxima página">
          <span className="hidden sm:inline">Próxima</span><span className="sm:hidden">›</span>
        </button>
        <button onClick={() => setPage(() => totalPages - 1)} disabled={page >= totalPages - 1} className="rounded-lg border border-border px-2.5 py-1.5 hover:border-primary/40 disabled:opacity-40" aria-label="Última página">»</button>
      </div>
    </div>
  );
};

type SortKey = "mrr" | "perfil";
const ClientesTable = ({ rows, hideAgente }: { rows: DashSucessoRow[]; hideAgente?: boolean }) => {
  const [agente, setAgente] = useState(ALL);
  const [perfil, setPerfil] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("mrr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc"); // maior → menor por padrão
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTS[0]);

  const agentesOpts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.agente_sucesso?.trim()).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );
  const perfisOpts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.perfil_cliente?.trim()).filter((x): x is string => !!x))).sort((a, b) => perfilRank(a) - perfilRank(b) || a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (agente !== ALL && (r.agente_sucesso?.trim() ?? "") !== agente) return false;
      if (perfil !== ALL && (r.perfil_cliente?.trim() ?? "") !== perfil) return false;
      return true;
    }),
    [rows, agente, perfil],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sortKey === "mrr"
        ? (num(a.mrr) - num(b.mrr)) * dir
        : (perfilRank(a.perfil_cliente) - perfilRank(b.perfil_cliente)) * dir,
    );
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);
  useEffect(() => { setPage(0); }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const hasFilter = agente !== ALL || perfil !== ALL;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!hideAgente && <FiltroSelect label="Agente" value={agente} onChange={setAgente} options={agentesOpts} />}
        <FiltroSelect label="Perfil" value={perfil} onChange={setPerfil} options={perfisOpts} />
        {hasFilter && (
          <button onClick={() => { setAgente(ALL); setPerfil(ALL); }} className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Limpar
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">
                <button type="button" onClick={() => toggleSort("perfil")} className="inline-flex items-center transition hover:text-foreground" title="Ordenar por perfil (P→GG)">
                  Perfil{arrow("perfil")}
                </button>
              </th>
              <th className="px-3 py-2 text-left">Agente</th>
              <th className="px-3 py-2 text-right">
                <button type="button" onClick={() => toggleSort("mrr")} className="inline-flex items-center transition hover:text-foreground" title="Ordenar por MRR">
                  MRR{arrow("mrr")}
                </button>
              </th>
              <th className="px-3 py-2 text-right">Fechado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((r, i) => (
              <tr key={`${r.id_deal}-${i}`} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium">
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
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.perfil_cliente ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.agente_sucesso?.trim() || "Sem responsável"}</td>
                <td className="px-3 py-2.5 text-right font-numeric font-semibold tabular-nums">{fmtBRL(num(r.mrr))}</td>
                <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtFechado(r.data_fechamento)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum churn no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > 0 && (
        <PaginationBar total={sorted.length} page={pageSafe} pageSize={pageSize} totalPages={totalPages} setPage={setPage} setPageSize={setPageSize} />
      )}
    </div>
  );
};

const StatCards = ({ stats }: { stats: ChurnStats }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <KpiCard label="Churn no período" value={stats.qtd.toLocaleString("pt-BR")} icon={TrendingDown} tone="warning" hint="deals fechados em Churn (Sucesso)" />
    <KpiCard label="MRR perdido" value={fmtBRL(stats.mrr)} icon={DollarSign} tone="warning" hint="soma do MRR dos churns" />
    <KpiCard label="P+M" value={`${stats.qtdPM.toLocaleString("pt-BR")} · ${fmtBRL(stats.mrrPM)}`} icon={UserCheck} tone="secondary" hint={`${fmtPct(pct(stats.qtdPM, stats.qtd), 1)} dos churns`} />
    <KpiCard label="G+GG" value={`${stats.qtdGGG.toLocaleString("pt-BR")} · ${fmtBRL(stats.mrrGGG)}`} icon={Building2} tone="primary" hint={`${fmtPct(pct(stats.qtdGGG, stats.qtd), 1)} dos churns`} />
  </div>
);

// Selor de filtro reutilizável (com opção "todos").
const FiltroSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL}>{label}: todos</SelectItem>
      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);

// Linha rótulo/valor do modal de detalhe.
const Campo = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-0">
    <span className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    <span className="text-foreground">{children}</span>
  </div>
);

// ---- Aba Motivos: dados de dash_sucesso (etapa Churn) com filtros + modal ----
const MotivosTab = ({ rows }: { rows: DashSucessoRow[] }) => {
  const [q, setQ] = useState("");
  const [nivel, setNivel] = useState<Nivel>("n1"); // por padrão mostra só N1
  const [perfil, setPerfil] = useState(ALL);
  const [agente, setAgente] = useState(ALL);
  const [detalhe, setDetalhe] = useState<DashSucessoRow | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTS[0]);

  const perfisOpts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.perfil_cliente?.trim()).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );
  const agentesOpts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.agente_sucesso?.trim()).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (perfil !== ALL && (r.perfil_cliente?.trim() ?? "") !== perfil) return false;
      if (agente !== ALL && (r.agente_sucesso?.trim() ?? "") !== agente) return false;
      if (term) {
        const hay = [r.nome_negocio, r.agente_sucesso, r.perfil_cliente, r.etapa_de_cancelamento, ...motivosOf(r)]
          .join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, perfil, agente]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(pageSafe * pageSize, (pageSafe + 1) * pageSize);
  useEffect(() => { setPage(0); }, [filtered]);

  const hasFilter = q.trim() !== "" || nivel !== "n1" || perfil !== ALL || agente !== ALL;
  const clear = () => { setQ(""); setNivel("n1"); setPerfil(ALL); setAgente(ALL); };

  return (
    <div className="space-y-3">
      <p className="font-small text-xs text-muted-foreground">
        Clientes em <strong>Churn</strong> no período. Por padrão mostra o motivo <strong>N1</strong> — troque o nível no filtro. Clique numa linha para ver os 3 níveis e o resto.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, motivo, agente…" className="pl-9" />
        </div>
        <Select value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="n1">Nível: N1</SelectItem>
            <SelectItem value="n2">Nível: N2</SelectItem>
            <SelectItem value="n3">Nível: N3</SelectItem>
            <SelectItem value="todos">Nível: todos</SelectItem>
          </SelectContent>
        </Select>
        <FiltroSelect label="Perfil" value={perfil} onChange={setPerfil} options={perfisOpts} />
        <FiltroSelect label="Agente" value={agente} onChange={setAgente} options={agentesOpts} />
        {hasFilter && (
          <button onClick={clear} className="font-subtitle text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Limpar
          </button>
        )}
      </div>

      <p className="font-small text-xs text-muted-foreground">
        {filtered.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} churns
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Motivo ({NIVEL_LABEL[nivel]})</th>
              <th className="px-3 py-2 text-left">Perfil</th>
              <th className="px-3 py-2 text-left">Agente de Sucesso</th>
              <th className="px-3 py-2 text-left">Etapa cancelamento</th>
              <th className="px-3 py-2 text-right">Ativação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((r, i) => {
              const ms = motivosForNivel(r, nivel);
              return (
                <tr key={`${r.id_deal}-${i}`} onClick={() => setDetalhe(r)} className="cursor-pointer hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.nome_negocio ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {ms.length ? (
                      <div className="flex flex-wrap gap-1">
                        {ms.map((m, j) => (
                          <span key={j} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">{m}</span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.perfil_cliente ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.agente_sucesso?.trim() || "Sem responsável"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.etapa_de_cancelamento?.trim() || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">{fmtFechado(r.data_ativacao)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum churn corresponde aos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <PaginationBar total={filtered.length} page={pageSafe} pageSize={pageSize} totalPages={totalPages} setPage={setPage} setPageSize={setPageSize} />
      )}

      {/* Modal de detalhe (todas as infos do deal) */}
      <Dialog open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalhe(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{detalhe?.nome_negocio ?? "Detalhes do churn"}</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-2.5 text-sm">
              <Campo label="Motivos">
                {motivosOf(detalhe).length ? (
                  <div className="flex flex-wrap gap-1">
                    {motivosOf(detalhe).map((m, j) => (
                      <span key={j} className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">{m}</span>
                    ))}
                  </div>
                ) : "—"}
              </Campo>
              <Campo label="Perfil do cliente">{detalhe.perfil_cliente ?? "—"}</Campo>
              <Campo label="Agente de Sucesso">{detalhe.agente_sucesso?.trim() || "Sem responsável"}</Campo>
              <Campo label="Etapa de cancelamento">{detalhe.etapa_de_cancelamento?.trim() || "—"}</Campo>
              <Campo label="Data de ativação">{fmtFechado(detalhe.data_ativacao)}</Campo>
              <Campo label="Fechado em">{fmtFechado(detalhe.data_fechamento)}</Campo>
              <Campo label="MRR">{fmtBRL(num(detalhe.mrr))}</Campo>
              <a
                href={hubspotDealUrl(detalhe.id_deal)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                Abrir no HubSpot <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function SucessoChurn() {
  const { fullName, agenteAtivacao } = useAuth();
  const myAgente = (agenteAtivacao ?? fullName ?? "").trim();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  const { rowsRaw, isLoading } = useDashSucesso(useMemo(() => ({}), []));

  // Churn do período (etapa Churn) já recortado por data_fechamento.
  const churnPeriodo = useMemo(
    () => rowsRaw.filter((r) => norm(r.etapa_negocio) === "churn" && matchPeriodo(r.data_fechamento, month, year)),
    [rowsRaw, month, year],
  );
  // Regra "Só Sucesso" (Visão Geral / MRR / Meu Desempenho).
  const churnSucesso = useMemo(
    () => churnPeriodo.filter((r) => norm(r.etapa_de_cancelamento) === "sucesso"),
    [churnPeriodo],
  );
  // Meu Desempenho: churn (Sucesso) do agente logado.
  const meusChurns = useMemo(
    () => churnSucesso.filter((r) => norm(r.agente_sucesso) === norm(myAgente)),
    [churnSucesso, myAgente],
  );

  const statsGeral = useMemo(() => computeStats(churnSucesso), [churnSucesso]);
  const statsMeu = useMemo(() => computeStats(meusChurns), [meusChurns]);

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">Sucesso</p>
              <h1 className="font-display text-xl font-semibold text-secondary">
                Churn · {MONTHS_PT[month]} / {year}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <RefreshDataButton event="atualizar_dados_sucesso" invalidateKey="dash_sucesso" />
          </div>
        </div>

        <Tabs defaultValue="visao" className="w-full">
          <TabsList>
            <TabsTrigger value="visao" className="gap-1.5"><Users className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="meu" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" />Meu Desempenho</TabsTrigger>
            <TabsTrigger value="motivos" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" />Motivos</TabsTrigger>
            <TabsTrigger value="mrr" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />MRR</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="visao" className="mt-4 space-y-4">
            <StatCards stats={statsGeral} />
            <ClientesTable rows={churnSucesso} />
          </TabsContent>

          {/* MEU DESEMPENHO */}
          <TabsContent value="meu" className="mt-4 space-y-4">
            {!myAgente ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Seu usuário não está vinculado a um agente de Sucesso. Peça a um admin para definir seu agente no painel de Admin.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Mostrando o churn de <strong className="text-foreground">{myAgente}</strong> ·{" "}
                  {statsMeu.qtd.toLocaleString("pt-BR")} de {statsGeral.qtd.toLocaleString("pt-BR")} churns do mês
                  ({fmtPct(pct(statsMeu.qtd, statsGeral.qtd), 1)}) · {fmtBRL(statsMeu.mrr)} de MRR perdido.
                </div>
                <StatCards stats={statsMeu} />
                <ClientesTable rows={meusChurns} hideAgente />
              </>
            )}
          </TabsContent>

          {/* MOTIVOS */}
          <TabsContent value="motivos" className="mt-4">
            <MotivosTab rows={churnPeriodo} />
          </TabsContent>

          {/* MRR */}
          <TabsContent value="mrr" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="MRR perdido (total)" value={fmtBRL(statsGeral.mrr)} icon={DollarSign} tone="warning" hint={`${statsGeral.qtd.toLocaleString("pt-BR")} churns no mês`} />
              <KpiCard label="MRR perdido · P+M" value={fmtBRL(statsGeral.mrrPM)} icon={UserCheck} tone="secondary" hint={`${fmtPct(pct(statsGeral.mrrPM, statsGeral.mrr), 1)} do MRR perdido`} />
              <KpiCard label="MRR perdido · G+GG" value={fmtBRL(statsGeral.mrrGGG)} icon={Building2} tone="primary" hint={`${fmtPct(pct(statsGeral.mrrGGG, statsGeral.mrr), 1)} do MRR perdido`} />
            </div>
            <p className="font-small text-xs text-muted-foreground">Clientes do mês ordenados por MRR (maior → menor):</p>
            <ClientesTable rows={churnSucesso} />
          </TabsContent>
        </Tabs>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Carregando dados…</p>
        )}
      </main>
    </div>
  );
}
