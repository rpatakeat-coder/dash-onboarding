import { useMemo, useState } from "react";
import { CalendarDays, Sparkles, CalendarIcon, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  countNovosHoje,
  countEntradosNoPeriodo,
  fmtBRLk,
  getPeriodRanges,
  mrrAtivadoNoPeriodo,
  parseDate,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MrrAtivadoMesModal } from "./MrrAtivadoMesModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hubspotDealUrl } from "@/lib/hubspot";

interface Props {
  rows: DashRow[];
}

type PeriodKey = "todos" | "hoje" | "semana" | "mes" | "mesAnt" | "custom";

export const MacroMovimento = ({ rows }: Props) => {
  const novosHoje = countNovosHoje(rows);
  const r = getPeriodRanges();
  const [filter, setFilter] = useState<PeriodKey>("todos");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entradasOpen, setEntradasOpen] = useState(false);
  const [drillCard, setDrillCard] = useState<{ start: Date; end: Date; titulo: string; descricao: string } | null>(null);

  const entradasHojeRows = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return rows
      .filter((r) => {
        const d = parseDate(r.data_criacao);
        return d && d >= start && d < end;
      })
      .sort((a, b) => {
        const da = parseDate(a.data_criacao)?.getTime() ?? 0;
        const db = parseDate(b.data_criacao)?.getTime() ?? 0;
        return db - da;
      });
  }, [rows]);

  const periods = [
    {
      key: "hoje",
      label: "Hoje",
      start: r.todayStart,
      end: r.tomorrow,
      prevStart: new Date(r.todayStart.getFullYear(), r.todayStart.getMonth(), r.todayStart.getDate() - 1),
      prevEnd: r.todayStart,
      prevLabel: "ontem",
      accent: "text-primary",
    },
    {
      key: "semana",
      label: "Esta semana",
      start: r.weekStart,
      end: r.nextWeek,
      prevStart: new Date(r.weekStart.getFullYear(), r.weekStart.getMonth(), r.weekStart.getDate() - 7),
      prevEnd: r.weekStart,
      prevLabel: "semana anterior",
      accent: "text-foreground",
    },
    {
      key: "mes",
      label: "Este mês",
      start: r.monthStart,
      end: r.nextMonth,
      prevStart: r.lastMonthStart,
      prevEnd: r.monthStart,
      prevLabel: "mês anterior",
      accent: "text-success",
    },
    {
      key: "mesAnt",
      label: "Mês anterior",
      start: r.lastMonthStart,
      end: r.monthStart,
      prevStart: new Date(r.lastMonthStart.getFullYear(), r.lastMonthStart.getMonth() - 1, 1),
      prevEnd: r.lastMonthStart,
      prevLabel: "mês retrasado",
      accent: "text-muted-foreground",
    },
  ] as const;

  const filterOpts: { key: PeriodKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "mesAnt", label: "Mês anterior" },
  ];

  // MRR Criado no período = soma do mrr dos deals com data_criacao no intervalo
  const mrrCriadoNoPeriodo = (start: Date, end: Date) => {
    let sum = 0;
    for (const row of rows) {
      const d = parseDate(row.data_criacao);
      if (d && d >= start && d < end) sum += Number(row.mrr) || 0;
    }
    return sum;
  };

  // Build the cards list according to the active filter.
  let cards: {
    label: string;
    value: string;
    sub: string;
    pctAtiv: number;
    pctLabel: string;
    accent?: string;
    formula: string;
    start: Date;
    end: Date;
    titulo: string;
    descricao: string;
  }[] = [];

  if (filter === "custom" && customRange?.from) {
    const start = customRange.from;
    // end is exclusive — add 1 day to include "to"
    const toBase = customRange.to ?? customRange.from;
    const end = new Date(toBase.getFullYear(), toBase.getMonth(), toBase.getDate() + 1);
    const spanMs = end.getTime() - start.getTime();
    const prevEnd = start;
    const prevStart = new Date(start.getTime() - spanMs);
    const ativ = mrrAtivadoNoPeriodo(rows, start, end);
    const entrados = countEntradosNoPeriodo(rows, start, end);
    const mrrCriadoPrev = mrrCriadoNoPeriodo(prevStart, prevEnd);
    const pctAtiv = mrrCriadoPrev > 0 ? (ativ.mrr / mrrCriadoPrev) * 100 : 0;
    const label = `${format(start, "dd/MM/yyyy", { locale: ptBR })} → ${format(toBase, "dd/MM/yyyy", { locale: ptBR })}`;
    cards = [
      {
        label,
        value: fmtBRLk(ativ.mrr),
        sub: `${ativ.count} ativados · ${entrados} entrados`,
        pctAtiv,
        pctLabel: mrrCriadoPrev > 0 ? `${pctAtiv.toFixed(1).replace(".", ",")}% ativação` : "— sem base anterior",
        accent: "text-primary",
        formula: `% Ativação = MRR ativado no período (${fmtBRLk(ativ.mrr)}) ÷ MRR criado na janela anterior de mesma duração (${fmtBRLk(mrrCriadoPrev)}) × 100. Mesma regra do gráfico "MRR Ativado · Comparativo mensal".`,
        start,
        end,
        titulo: `MRR Ativado · ${label}`,
        descricao: "Detalhamento das ativações no período personalizado",
      },
    ];
  } else {
    const visiblePeriods = filter === "todos" ? periods : periods.filter((p) => p.key === filter);
    cards = visiblePeriods.map((p) => {
      const ativ = mrrAtivadoNoPeriodo(rows, p.start, p.end);
      const entrados = countEntradosNoPeriodo(rows, p.start, p.end);
      const mrrCriadoPrev = mrrCriadoNoPeriodo(p.prevStart, p.prevEnd);
      const pctAtiv = mrrCriadoPrev > 0 ? (ativ.mrr / mrrCriadoPrev) * 100 : 0;
      return {
        label: p.label,
        value: fmtBRLk(ativ.mrr),
        sub: `${ativ.count} ativados · ${entrados} entrados`,
        pctAtiv,
        pctLabel: mrrCriadoPrev > 0 ? `${pctAtiv.toFixed(1).replace(".", ",")}% ativação` : "— sem base anterior",
        accent: p.accent,
        formula: `% Ativação = MRR ativado em ${p.label.toLowerCase()} (${fmtBRLk(ativ.mrr)}) ÷ MRR criado no(a) ${p.prevLabel} (${fmtBRLk(mrrCriadoPrev)}) × 100. Mesma regra do gráfico "MRR Ativado · Comparativo mensal".`,
        start: p.start,
        end: p.end,
        titulo: `MRR Ativado · ${p.label}`,
        descricao: `Detalhamento das ativações em ${p.label.toLowerCase()}`,
      };
    });
  }

  const customActive = filter === "custom" && !!customRange?.from;
  const customLabel = customActive
    ? customRange?.to
      ? `${format(customRange.from!, "dd/MM", { locale: ptBR })} → ${format(customRange.to, "dd/MM", { locale: ptBR })}`
      : format(customRange!.from!, "dd/MM/yyyy", { locale: ptBR })
    : "Personalizado";

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <button
        type="button"
        onClick={() => setEntradasOpen(true)}
        className="group relative rounded-2xl border border-success/30 bg-success/[0.04] p-5 text-left transition hover:border-success/60 hover:bg-success/[0.08] focus:outline-none focus:ring-2 focus:ring-success/40 lg:col-span-1"
      >
        <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
          <InfoTooltip text="Entradas hoje = contagem de deals cuja data de criação é hoje (00:00 → 23:59), sem aplicar filtros de etapa. Clique para ver os deals." />
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Entradas hoje
            </p>
            <p className="mt-2 font-numeric text-4xl font-bold text-success">
              {novosHoje}
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              {novosHoje === 1 ? "cliente entrou" : "clientes entraram"} no pipeline hoje
            </p>
          </div>
          <Sparkles className="h-6 w-6 text-success/70 transition group-hover:scale-110" />
        </div>
      </button>


      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft lg:col-span-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-secondary">
              MRR ativado por período
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Clientes entrados (data de criação) e ativados (data de ativação) no período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
              {filterOpts.map((o) => {
                const active = filter === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setFilter(o.key)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-subtitle text-xs font-semibold transition",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-lg font-subtitle text-xs font-semibold",
                    customActive
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from) setFilter("custom");
                    if (range?.from && range?.to) setPickerOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                {customActive && (
                  <div className="flex items-center justify-end gap-2 border-t border-border p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setCustomRange(undefined);
                        setFilter("todos");
                        setPickerOpen(false);
                      }}
                    >
                      <X className="h-3 w-3" />
                      Limpar
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <CalendarDays className="h-5 w-5 text-primary/70" />
          </div>
        </div>
        <div className={cn("grid gap-3", cards.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4")}>
          {cards.map((c) => (
            <button
              type="button"
              key={c.label}
              onClick={() => setDrillCard({ start: c.start, end: c.end, titulo: c.titulo, descricao: c.descricao })}
              className="group relative rounded-xl border border-border bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md-soft focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
                <InfoTooltip text={c.formula} />
              </div>
              <p className="font-subtitle text-xs text-muted-foreground">{c.label}</p>
              <p className={`mt-2 font-numeric text-2xl font-bold ${c.accent ?? ""}`}>
                {c.value}
              </p>
              <p className="mt-1 font-small text-xs text-muted-foreground">{c.sub}</p>
              <p
                className={cn(
                  "mt-1 font-numeric text-xs font-semibold",
                  c.pctAtiv >= 50 ? "text-success" : c.pctAtiv > 0 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {c.pctLabel}
              </p>
              <span className="pdf-hide mt-1 inline-block font-small text-[10px] text-primary/0 transition group-hover:text-primary">
                Clique para detalhar →
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={entradasOpen} onOpenChange={setEntradasOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Entradas hoje — {entradasHojeRows.length} {entradasHojeRows.length === 1 ? "deal" : "deals"}
            </DialogTitle>
            <DialogDescription>
              Deals criados em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })} (00:00 → 23:59).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Ativador</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradasHojeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Nenhuma entrada hoje.
                    </TableCell>
                  </TableRow>
                ) : (
                  entradasHojeRows.map((r) => {
                    const d = parseDate(r.data_criacao);
                    return (
                      <TableRow key={r.id_deal}>
                        <TableCell className="font-medium">{r.nome_negocio || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.perfil_cliente || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.etapa_negocio || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.agente_ativacao?.trim() || "—"}</TableCell>
                        <TableCell className="text-right font-numeric">{fmtBRLk(Number(r.mrr) || 0)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {d ? format(d, "dd/MM HH:mm", { locale: ptBR }) : "—"}
                        </TableCell>
                        <TableCell>
                          <a
                            href={hubspotDealUrl(r.id_deal)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-primary hover:text-primary/80"
                            title="Abrir no HubSpot"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <MrrAtivadoMesModal
        open={drillCard !== null}
        onOpenChange={(o) => !o && setDrillCard(null)}
        rows={rows}
        mesLabel={drillCard?.titulo ?? ""}
        periodStart={drillCard?.start}
        periodEnd={drillCard?.end}
        titulo={drillCard?.titulo}
        descricao={drillCard?.descricao}
      />
    </section>
  );
};
