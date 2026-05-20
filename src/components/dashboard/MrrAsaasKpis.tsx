import { useMemo, useState } from "react";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtBRL, filterByPeriod, parseDate, type DashRow, type PeriodKey } from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
import { PeriodFilter } from "./PeriodFilter";

interface Props {
  rows: DashRow[];
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Tolerância (R$) para considerar igual entre Hubspot e Asaas. */
const EPS = 0.5;

export const MrrAsaasKpis = ({ rows }: Props) => {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("tudo");
  const [range, setRange] = useState<DateRange | undefined>();

  const periodRows = useMemo(() => {
    if (range?.from) {
      const start = new Date(range.from); start.setHours(0, 0, 0, 0);
      const endBase = range.to ?? range.from;
      const end = new Date(endBase); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
      return rows.filter((r) => {
        const d = parseDate(r.data_criacao);
        return d && d >= start && d < end;
      });
    }
    return filterByPeriod(rows, period);
  }, [rows, period, range]);


  const data = useMemo(() => {
    // Considera apenas deals que possuem vínculo com Asaas (asaas_id presente).
    const withAsaas = periodRows.filter((r) => (r.asaas_id?.trim() ?? "") !== "");
    const totalHubspot = withAsaas.reduce((s, r) => s + num(r.mrr), 0);
    const totalAsaas = withAsaas.reduce((s, r) => s + num(r.mrr_asaas), 0);
    const diff = totalAsaas - totalHubspot;
    const diffPct = totalHubspot > 0 ? (diff / totalHubspot) * 100 : 0;

    type Motivo = "sem_asaas_id" | "sem_mrr_asaas" | "diferenca";
    const divergentes = periodRows
      .map((r) => {
        const hasAsaasId = (r.asaas_id?.trim() ?? "") !== "";
        const h = num(r.mrr);
        const a = num(r.mrr_asaas);
        const delta = a - h;
        let motivo: Motivo | null = null;
        if (!hasAsaasId) {
          if (h > 0) motivo = "sem_asaas_id";
        } else if (a === 0 && h > EPS) {
          motivo = "sem_mrr_asaas";
        } else if (Math.abs(delta) > EPS) {
          motivo = "diferenca";
        }
        return { row: r, hubspot: h, asaas: a, delta, motivo: motivo as Motivo | null };
      })
      .filter((x): x is { row: typeof x.row; hubspot: number; asaas: number; delta: number; motivo: Motivo } => x.motivo !== null)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      totalHubspot,
      totalAsaas,
      diff,
      diffPct,
      countWithAsaas: withAsaas.length,
      countSemAsaas: periodRows.length - withAsaas.length,
      divergentes,
    };
  }, [periodRows]);

  const positive = data.diff >= 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            MRR Hubspot × Asaas
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Comparativo entre o MRR registrado no Hubspot e o MRR efetivamente cobrado no Asaas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter
            value={period}
            onChange={(v) => { setPeriod(v); setRange(undefined); }}
          />
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
                onSelect={(r) => { setRange(r); if (r?.from) setPeriod("tudo"); }}
                numberOfMonths={2}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>



      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* MRR Hubspot */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR Hubspot
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Soma do MRR registrado no campo `mrr` do Hubspot, considerando apenas deals que possuem vínculo com Asaas (asaas_id preenchido)." />
              <DollarSign className="h-4 w-4 text-primary/70" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-primary">
            {fmtBRL(data.totalHubspot)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {data.countWithAsaas} deals com Asaas
          </p>
        </div>

        {/* MRR Asaas */}
        <div className="rounded-xl border border-success/30 bg-success/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR Asaas
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Soma do MRR cobrado de fato no Asaas (campo `mrr_asaas`). Representa a receita recorrente real que está sendo faturada." />
              <DollarSign className="h-4 w-4 text-success/70" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-success">
            {fmtBRL(data.totalAsaas)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            cobrado no faturamento
          </p>
        </div>

        {/* Diferença */}
        <div
          className={cn(
            "rounded-xl border p-4",
            positive
              ? "border-success/30 bg-success/[0.04]"
              : "border-destructive/30 bg-destructive/[0.04]",
          )}
        >
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Diferença (Asaas − Hub)
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Asaas − Hubspot. Positivo significa que estamos cobrando MAIS no Asaas do que o registrado no Hubspot; negativo indica receita potencialmente perdida (cobrando menos do que o contratado)." />
              {positive ? (
                <TrendingUp className="h-4 w-4 text-success/80" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive/80" />
              )}
            </div>
          </div>
          <p
            className={cn(
              "mt-2 font-numeric text-3xl font-bold",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? "+" : ""}
            {fmtBRL(data.diff)}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {positive ? "+" : ""}
            {data.diffPct.toFixed(1)}% vs Hubspot
          </p>
        </div>

        {/* Deals divergentes (clicável) */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group rounded-xl border border-secondary/30 bg-secondary/[0.04] p-4 text-left transition hover:opacity-90"
        >
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Deals divergentes
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Quantidade de deals em que o MRR do Hubspot difere do MRR do Asaas (tolerância de R$ 0,50). Clique no card para ver a lista completa." />
              <AlertTriangle className="h-4 w-4 text-secondary/80" />
            </div>
          </div>
          <p className="mt-2 font-numeric text-3xl font-bold text-secondary">
            {data.divergentes.length}
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {data.countSemAsaas > 0
              ? `${data.countSemAsaas} sem Asaas vinculado`
              : "clique para detalhar →"}
          </p>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Deals com divergência Hubspot × Asaas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead className="text-right">Hubspot</TableHead>
                  <TableHead className="text-right">Asaas</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Ativador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.divergentes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum deal divergente.
                    </TableCell>
                  </TableRow>
                )}
                {data.divergentes.map(({ row, hubspot, asaas, delta, motivo }) => {
                  const pos = delta >= 0;
                  const motivoMeta = {
                    sem_asaas_id: {
                      label: "Sem asaas_id",
                      tip: "Deal não possui vínculo com cobrança no Asaas (asaas_id ausente), mas tem MRR no Hubspot.",
                      cls: "border-secondary/40 bg-secondary/10 text-secondary",
                    },
                    sem_mrr_asaas: {
                      label: "MRR Asaas faltante",
                      tip: "Deal possui asaas_id, mas o valor de mrr_asaas está zerado — provavelmente cobrança não configurada/ativa.",
                      cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    },
                    diferenca: {
                      label: "Diferença real",
                      tip: "Asaas e Hubspot possuem valores divergentes acima da tolerância (R$ 0,50).",
                      cls: "border-destructive/40 bg-destructive/10 text-destructive",
                    },
                  }[motivo];
                  return (
                    <TableRow key={row.id_deal}>
                      <TableCell className="font-medium">
                        {row.nome_negocio || "—"}
                      </TableCell>
                      <TableCell className="text-right font-numeric tabular-nums">
                        {fmtBRL(hubspot)}
                      </TableCell>
                      <TableCell className="text-right font-numeric tabular-nums">
                        {fmtBRL(asaas)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-numeric font-semibold tabular-nums",
                          pos ? "text-success" : "text-destructive",
                        )}
                      >
                        {pos ? "+" : ""}
                        {fmtBRL(delta)}
                      </TableCell>
                      <TableCell>
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-flex cursor-help items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                motivoMeta.cls,
                              )}
                            >
                              {motivoMeta.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                            {motivoMeta.tip}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.agente_ativacao || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
