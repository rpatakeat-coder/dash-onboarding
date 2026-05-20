import { useMemo, useState } from "react";
import { CalendarIcon, ExternalLink, Search, Users, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fmtBRL,
  fmtBRLk,
  formatActivationDate,
  mrrAtivadoNoPeriodo,
  getPeriodRanges,
  parseActivationDate,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
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
import { hubspotDealUrl } from "@/lib/hubspot";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  rows: DashRow[];
}

type PeriodKey = "hoje" | "semana" | "mes" | "mes_ant" | "tudo";

const SEM_RESP = "Sem responsável";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "mes_ant", label: "Mês ant." },
  { key: "tudo", label: "Tudo" },
];

export const MrrAtivadoPorAtivador = ({ rows }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [range, setRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<string | null>(null);


  const { start, end, label } = useMemo(() => {
    if (range?.from) {
      const s = new Date(range.from); s.setHours(0, 0, 0, 0);
      const eBase = range.to ?? range.from;
      const e = new Date(eBase); e.setHours(0, 0, 0, 0); e.setDate(e.getDate() + 1);
      const lbl = range.to
        ? `${format(range.from, "dd/MM/yy", { locale: ptBR })} – ${format(range.to, "dd/MM/yy", { locale: ptBR })}`
        : format(range.from, "dd/MM/yy", { locale: ptBR });
      return { start: s, end: e, label: lbl };
    }
    const r = getPeriodRanges();
    switch (period) {
      case "hoje":
        return { start: r.todayStart, end: r.tomorrow, label: "Hoje" };
      case "semana":
        return { start: r.weekStart, end: r.nextWeek, label: "Esta semana" };
      case "mes":
        return { start: r.monthStart, end: r.nextMonth, label: "Mês atual" };
      case "mes_ant":
        return { start: r.lastMonthStart, end: r.monthStart, label: "Mês anterior" };
      case "tudo":
      default:
        return { start: new Date(0), end: new Date(8640000000000000), label: "Tudo" };
    }
  }, [period, range]);

  const { lista, totalMrr, totalCount } = useMemo(() => {
    const map = new Map<string, { mrr: number; count: number }>();
    for (const r of rows) {
      const k = r.agente_ativacao?.trim() || SEM_RESP;
      if (!map.has(k)) map.set(k, { mrr: 0, count: 0 });
    }
    for (const [nome] of map) {
      const subset = rows.filter((r) => (r.agente_ativacao?.trim() || SEM_RESP) === nome);
      const { mrr, count } = mrrAtivadoNoPeriodo(subset, start, end);
      map.set(nome, { mrr, count });
    }
    const lista = [...map.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.mrr - a.mrr);
    const totalMrr = lista.reduce((s, x) => s + x.mrr, 0);
    const totalCount = lista.reduce((s, x) => s + x.count, 0);
    return { lista, totalMrr, totalCount };
  }, [rows, start, end]);

  const chartHeight = Math.max(180, lista.length * 36 + 20);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-secondary">
            MRR Ativado por ativador
            <InfoTooltip text="Soma do MRR dos deals com data_ativacao dentro do período, agrupado por agente de ativação. Use os filtros de período (incluindo intervalo personalizado) para comparar performance." />
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {label} · {fmtBRL(totalMrr)} · {totalCount} ativação{totalCount === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm-soft">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPeriod(p.key); setRange(undefined); }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 font-subtitle text-xs font-semibold transition",
                  period === p.key && !range?.from
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 rounded-xl font-subtitle text-xs",
                  range?.from && "border-primary/50 bg-primary/5 text-primary",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {range?.from ? (
                  range.to ? (
                    <>
                      {format(range.from, "dd/MM/yy", { locale: ptBR })} – {format(range.to, "dd/MM/yy", { locale: ptBR })}
                    </>
                  ) : (
                    format(range.from, "dd/MM/yy", { locale: ptBR })
                  )
                ) : (
                  "Personalizado"
                )}
                {range?.from && (
                  <X
                    className="ml-1 h-3 w-3 opacity-70 hover:opacity-100"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRange(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => setRange(r)}
                numberOfMonths={2}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Users className="h-5 w-5 shrink-0 text-primary/70" />
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="font-small text-sm text-muted-foreground">
          Nenhuma ativação no período selecionado.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={lista}
              layout="vertical"
              margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nome"
                width={150}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) => {
                  const count = (item?.payload as { count: number } | undefined)?.count ?? 0;
                  return [`${fmtBRL(value)} · ${count} ativ.`, "MRR Ativado"];
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Bar
                dataKey="mrr"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(d: { nome?: string }) => d?.nome && setSelected(d.nome)}
              >
                <LabelList
                  dataKey="mrr"
                  position="right"
                  formatter={(v: number) => fmtBRLk(v)}
                  style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <AtivadorDealsModal
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        ativador={selected}
        rows={rows}
        start={start}
        end={end}
        periodLabel={label}
      />
    </section>
  );
};

// ============================================================
// Modal: deals ativados de um ativador no período selecionado
// ============================================================

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface ModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ativador: string | null;
  rows: DashRow[];
  start: Date;
  end: Date;
  periodLabel: string;
}

type SortKey = "cliente" | "perfil" | "mrr" | "data" | "sla";

const AtivadorDealsModal = ({
  open,
  onOpenChange,
  ativador,
  rows,
  start,
  end,
  periodLabel,
}: ModalProps) => {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ativados = useMemo(() => {
    if (!ativador) return [];
    return rows
      .map((row) => {
        const nome = row.agente_ativacao?.trim() || SEM_RESP;
        if (nome !== ativador) return null;
        const d = parseActivationDate(row.data_ativacao);
        if (!d || d < start || d >= end) return null;
        const perfilRaw = row.perfil_cliente?.trim() || "";
        const perfilKey = perfilRaw.split(/\s+/)[0]?.toUpperCase() || "—";
        return {
          id: row.id_deal,
          cliente: row.nome_negocio?.trim() || "—",
          perfil: perfilKey === "ISENTO" ? "Isento" : perfilKey,
          mrr: toNum(row.mrr),
          dataStr: formatActivationDate(row.data_ativacao),
          dataObj: d,
          sla: toNum(row.sla_dias_real) || toNum(row.sla_dias_etapa),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [rows, ativador, start, end]);

  const totalMrr = ativados.reduce((s, x) => s + x.mrr, 0);
  const totalQtd = ativados.length;
  const ticketMedio = totalQtd > 0 ? totalMrr / totalQtd : 0;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? ativados.filter((a) => a.cliente.toLowerCase().includes(term))
      : ativados;
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
  }, [ativados, q, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "cliente" || k === "perfil" ? "asc" : "desc");
    }
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {ativador} · MRR Ativado
          </DialogTitle>
          <DialogDescription>
            {periodLabel} · {totalQtd} ativação{totalQtd === 1 ? "" : "es"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-success/30 bg-success/[0.04] p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR Total
            </p>
            <p className="mt-2 font-numeric text-2xl font-bold text-success">{fmtBRL(totalMrr)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Ativações
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-secondary">
              Deals ({filtered.length.toLocaleString("pt-BR")})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <Th k="cliente">Cliente</Th>
                  <Th k="perfil">Perfil</Th>
                  <Th k="mrr" className="text-right">MRR</Th>
                  <Th k="data">Data Ativação</Th>
                  <Th k="sla" className="text-right">SLA (d)</Th>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{row.perfil}</TableCell>
                    <TableCell className="text-right font-numeric tabular-nums">
                      {fmtBRL(row.mrr)}
                    </TableCell>
                    <TableCell className="font-numeric tabular-nums text-muted-foreground">
                      {row.dataStr || "—"}
                    </TableCell>
                    <TableCell className="text-right font-numeric tabular-nums text-muted-foreground">
                      {row.sla ? row.sla.toFixed(0) : "—"}
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
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma ativação encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
};
