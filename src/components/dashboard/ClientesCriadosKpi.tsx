import { useMemo, useState } from "react";
import { UserPlus, TrendingUp, TrendingDown } from "lucide-react";
import { parseDate, fmtBRL, type DashRow } from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
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
import { DealLink } from "@/components/dashboard/DealLink";

interface Props {
  /** Já vem filtrado por ativador/etapa via filtros globais (macroRows). */
  rows: DashRow[];
}

type PeriodKey = "hoje" | "semana" | "mes" | "trimestre" | "tudo";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "tudo", label: "Tudo" },
];

const startOfDay = (d: Date) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
};
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfQuarter = (d: Date) => {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
};

function getRanges(period: PeriodKey) {
  const now = new Date();
  if (period === "tudo") {
    return {
      start: new Date(0),
      end: new Date(8640000000000000),
      prevStart: null as Date | null,
      prevEnd: null as Date | null,
    };
  }
  if (period === "hoje") {
    const start = startOfDay(now);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
    return { start, end, prevStart, prevEnd: start };
  }
  if (period === "semana") {
    const start = startOfWeek(now);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    return { start, end, prevStart, prevEnd: start };
  }
  if (period === "trimestre") {
    const start = startOfQuarter(now);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
    return { start, end, prevStart, prevEnd: start };
  }
  // mes
  const start = startOfMonth(now);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: start };
}

export const ClientesCriadosKpi = ({ rows }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("hoje");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const normPerfil = (raw: string | null | undefined): "P" | "M" | "G" | "GG" | "—" => {
    const v = (raw ?? "").trim().toUpperCase();
    if (v.startsWith("GG")) return "GG";
    if (v.startsWith("G")) return "G";
    if (v.startsWith("M")) return "M";
    if (v.startsWith("P")) return "P";
    return "—";
  };

  const { count, prevCount, byAtivador, byEtapa, byPerfil, label, filtered } = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getRanges(period);
    const inRange = (raw: string | null, s: Date, e: Date) => {
      const d = parseDate(raw);
      return d ? d >= s && d < e : false;
    };
    const filtered = rows.filter((r) => inRange(r.data_criacao, start, end));
    const prevFiltered = prevStart && prevEnd
      ? rows.filter((r) => inRange(r.data_criacao, prevStart, prevEnd))
      : [];

    const ativMap = new Map<string, number>();
    const etapaMap = new Map<string, number>();
    const perfilMap = new Map<string, number>();
    for (const r of filtered) {
      const a = r.agente_ativacao?.trim() || "Sem responsável";
      const e = r.etapa_negocio?.trim() || "Sem etapa";
      const p = normPerfil(r.perfil_cliente);
      ativMap.set(a, (ativMap.get(a) ?? 0) + 1);
      if (!/^\d+$/.test(e)) etapaMap.set(e, (etapaMap.get(e) ?? 0) + 1);
      perfilMap.set(p, (perfilMap.get(p) ?? 0) + 1);
    }

    const labelMap: Record<PeriodKey, string> = {
      hoje: "Hoje",
      semana: "Esta semana",
      mes: "Este mês",
      trimestre: "Este trimestre",
      tudo: "Histórico completo",
    };

    const perfilOrder = ["P", "M", "G", "GG", "—"];
    return {
      count: filtered.length,
      prevCount: prevFiltered.length,
      byAtivador: [...ativMap.entries()].sort((a, b) => b[1] - a[1]),
      byEtapa: [...etapaMap.entries()].sort((a, b) => b[1] - a[1]),
      byPerfil: [...perfilMap.entries()].sort(
        (a, b) => perfilOrder.indexOf(a[0]) - perfilOrder.indexOf(b[0]),
      ),
      label: labelMap[period],
      filtered,
    };
  }, [rows, period]);

  const term = q.trim().toLowerCase();
  const listaModal = useMemo(() => {
    const arr = filtered.map((r) => ({
      id: r.id_deal,
      cliente: r.nome_negocio?.trim() || "—",
      etapa: r.etapa_negocio?.trim() || "—",
      ativador: r.agente_ativacao?.trim() || "—",
      perfil: normPerfil(r.perfil_cliente),
      criacao: parseDate(r.data_criacao),
      mrr: r.mrr,
    }));
    const f = term
      ? arr.filter(
          (r) =>
            r.cliente.toLowerCase().includes(term) ||
            r.etapa.toLowerCase().includes(term) ||
            r.ativador.toLowerCase().includes(term) ||
            r.perfil.toLowerCase().includes(term),
        )
      : arr;
    return f.sort((a, b) => (b.criacao?.getTime() ?? 0) - (a.criacao?.getTime() ?? 0));
  }, [filtered, term]);

  const delta = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : count > 0 ? 100 : 0;
  const showDelta = period !== "tudo";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            Clientes criados
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {label} · respeita os filtros de ativador e etapa
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded px-2 py-1 font-subtitle text-[11px] font-semibold transition",
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 text-left transition hover:border-primary/60 hover:bg-primary/[0.08] focus:outline-none focus:ring-2 focus:ring-primary/40"
          title="Ver lista de clientes criados no período"
        >
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Total criado
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Quantidade de deals com data_criacao dentro do período selecionado, respeitando filtros globais de ativador e etapa. Clique para ver a lista." />
              <UserPlus className="h-4 w-4 text-primary/70" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-primary">
            {count.toLocaleString("pt-BR")}
          </p>
          {showDelta && (
            <p className="mt-1 flex items-center gap-1 font-small text-xs text-muted-foreground">
              {delta >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
              </span>
              <span>vs. período anterior ({prevCount})</span>
            </p>
          )}
        </button>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Por ativador
          </p>
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
            {byAtivador.length === 0 && (
              <p className="font-small text-xs text-muted-foreground">Sem dados no período.</p>
            )}
            {byAtivador.map(([nome, n]) => (
              <div key={nome} className="flex items-center justify-between gap-2 font-subtitle text-xs">
                <span className="truncate text-foreground">{nome}</span>
                <span className="font-numeric font-semibold tabular-nums text-foreground">
                  {n.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Por etapa
          </p>
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
            {byEtapa.length === 0 && (
              <p className="font-small text-xs text-muted-foreground">Sem dados no período.</p>
            )}
            {byEtapa.map(([etapa, n]) => (
              <div key={etapa} className="flex items-center justify-between gap-2 font-subtitle text-xs">
                <span className="truncate text-foreground">{etapa}</span>
                <span className="font-numeric font-semibold tabular-nums text-foreground">
                  {n.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            Por perfil
          </p>
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
            {byPerfil.length === 0 && (
              <p className="font-small text-xs text-muted-foreground">Sem dados no período.</p>
            )}
            {byPerfil.map(([perfil, n]) => {
              const color =
                perfil === "P" ? "text-success"
                : perfil === "M" ? "text-warning"
                : perfil === "G" ? "text-destructive"
                : perfil === "GG" ? "text-secondary"
                : "text-muted-foreground";
              const pct = count > 0 ? (n / count) * 100 : 0;
              return (
                <div key={perfil} className="flex items-center justify-between gap-2 font-subtitle text-xs">
                  <span className={cn("font-semibold", color)}>{perfil}</span>
                  <span className="font-numeric font-semibold tabular-nums text-foreground">
                    {n.toLocaleString("pt-BR")} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Clientes criados · {label}</DialogTitle>
            <DialogDescription>
              {listaModal.length.toLocaleString("pt-BR")} cliente{listaModal.length === 1 ? "" : "s"} · respeita filtros globais de ativador e etapa
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Ativador</TableHead>
                  <TableHead>Criação</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaModal.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <DealLink id={r.id}>{r.cliente}</DealLink>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.etapa}</TableCell>
                    <TableCell className="text-muted-foreground">{r.ativador}</TableCell>
                    <TableCell className="text-muted-foreground font-numeric tabular-nums">
                      {r.criacao ? r.criacao.toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-numeric tabular-nums">
                      {r.mrr ? fmtBRL(parseFloat(String(r.mrr).replace(",", "."))) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {listaModal.length === 0 && (
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
    </section>
  );
};
