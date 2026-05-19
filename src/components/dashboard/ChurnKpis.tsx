import { useEffect, useMemo, useState } from "react";
import { TrendingDown, ShieldAlert, CalendarIcon, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  computeChurnKpis,
  fmtBRL,
  getPeriodRanges,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

interface Props {
  /** Base completa (todas as rows) — o filtro de etapa/período é feito aqui dentro. */
  rows: DashRow[];
  className?: string;
}

type PeriodKey = "hoje" | "semana" | "mes" | "mesAnt" | "tudo" | "custom";

export const ChurnKpis = ({ rows, className }: Props) => {
  const r = getPeriodRanges();
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);

  // MRR início do mês vindo da planilha (Google Sheets · Mensal 2026!B2)
  const [mrrBase, setMrrBase] = useState<number | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetFetchedAt, setSheetFetchedAt] = useState<string | null>(null);

  const fetchSheetPct = async () => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const { data, error } = await supabase.functions.invoke("churn-real-sheet");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const resolveMrrBase = () => {
        if (typeof data?.mrrBase === "number") return data.mrrBase;
        if (typeof data?.raw === "number") return data.raw;
        if (typeof data?.pct === "number") return data.pct;

        const fallback = data?.raw ?? data?.mrrBase ?? data?.pct;
        if (typeof fallback === "string") {
          const normalized = fallback
            .replace(/r\$/i, "")
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim();
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
      };

      setMrrBase(resolveMrrBase());
      setSheetFetchedAt(data?.fetchedAt ?? null);
    } catch (e) {
      setSheetError((e as Error).message);
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetPct();
  }, []);


  const presets: Record<Exclude<PeriodKey, "custom">, { start: Date; end: Date; label: string }> = {
    hoje: { start: r.todayStart, end: r.tomorrow, label: "Hoje" },
    semana: { start: r.weekStart, end: r.nextWeek, label: "Esta semana" },
    mes: {
      start: r.monthStart,
      end: r.nextMonth,
      label: r.monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    },
    mesAnt: {
      start: r.lastMonthStart,
      end: r.monthStart,
      label: r.lastMonthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    },
    tudo: { start: new Date(0), end: new Date(8640000000000000), label: "Tudo" },
  };

  const activeRange = useMemo(() => {
    if (period === "custom" && customRange?.from) {
      const toBase = customRange.to ?? customRange.from;
      const end = new Date(toBase.getFullYear(), toBase.getMonth(), toBase.getDate() + 1);
      const label = customRange.to
        ? `${format(customRange.from, "dd/MM/yyyy", { locale: ptBR })} → ${format(toBase, "dd/MM/yyyy", { locale: ptBR })}`
        : format(customRange.from, "dd/MM/yyyy", { locale: ptBR });
      return { start: customRange.from, end, label };
    }
    const key = period === "custom" ? "mes" : period;
    return presets[key];
  }, [period, customRange, presets]);

  const k = computeChurnKpis(rows, { start: activeRange.start, end: activeRange.end });

  const headerLabel = activeRange.label.charAt(0).toUpperCase() + activeRange.label.slice(1);
  const dentroMeta = k.churnReal <= k.churnMaximo;
  const pctClamped = Math.min(100, Math.max(0, k.pctDoMaximo));

  const opts: { key: PeriodKey; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "mesAnt", label: "Mês ant." },
    { key: "tudo", label: "Tudo" },
  ];

  const customActive = period === "custom" && !!customRange?.from;
  const customLabel = customActive
    ? customRange?.to
      ? `${format(customRange.from!, "dd/MM", { locale: ptBR })} → ${format(customRange.to, "dd/MM", { locale: ptBR })}`
      : format(customRange!.from!, "dd/MM/yyyy", { locale: ptBR })
    : "Personalizado";

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Churn · {headerLabel}
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Pré-Churn + Churn (Sucesso) + Cancelamento (Onboarding) — fechados no período
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
            {opts.map((o) => {
              const active = period === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setPeriod(o.key)}
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
                  if (range?.from) setPeriod("custom");
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
                      setPeriod("mes");
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

          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-subtitle text-[11px] font-semibold",
              dentroMeta
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
            )}
          >
            {dentroMeta ? "Dentro da meta" : "Acima da meta"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* % Churn Real (planilha) */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between gap-2 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5" />
              % Churn Real
            </span>
            <button
              type="button"
              onClick={fetchSheetPct}
              disabled={sheetLoading}
              className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Atualizar da planilha"
            >
              <RefreshCw className={cn("h-3 w-3", sheetLoading && "animate-spin")} />
            </button>
          </div>
          {(() => {
            const pct = mrrBase && mrrBase > 0 ? (k.churnReal / mrrBase) * 100 : null;
            return (
              <>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                  {sheetLoading && pct === null
                    ? "…"
                    : pct !== null
                    ? `${pct.toFixed(2).replace(".", ",")}%`
                    : "—"}
                </p>
                <p className="font-small text-xs text-muted-foreground">
                  {sheetError
                    ? `Erro: ${sheetError}`
                    : mrrBase !== null
                    ? `${fmtBRL(k.churnReal)} ÷ ${fmtBRL(mrrBase)} (MRR início do mês)`
                    : "Lendo MRR início do mês (Mensal 2026 · B2)…"}
                </p>
                {sheetFetchedAt && (
                  <p className="font-small text-[10px] text-muted-foreground/70">
                    Planilha · {new Date(sheetFetchedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                )}
              </>
            );
          })()}
        </div>


        {/* Churn Máximo */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center gap-2 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Churn máximo (meta)
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            {fmtBRL(k.churnMaximo)}
          </p>
          <p className="font-small text-xs text-muted-foreground">
            9% × {fmtBRL(k.mrrCriadoMes)} de MRR criado no período
          </p>
        </div>

        {/* Churn Real */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center gap-2 font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            Churn real
          </div>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-bold tabular-nums",
              dentroMeta ? "text-foreground" : "text-destructive",
            )}
          >
            {fmtBRL(k.churnReal)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-small text-xs text-muted-foreground">
              {k.churnRealCount} deal{k.churnRealCount === 1 ? "" : "s"} fechado
              {k.churnRealCount === 1 ? "" : "s"}
            </span>
            <span
              className={cn(
                "font-numeric text-xs font-semibold tabular-nums",
                dentroMeta ? "text-success" : "text-destructive",
              )}
            >
              {k.pctDoMaximo.toFixed(1)}% do máximo
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                dentroMeta ? "bg-success" : "bg-destructive",
              )}
              style={{ width: `${pctClamped}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
