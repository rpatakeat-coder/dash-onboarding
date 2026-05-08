import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodFilter } from "./PeriodFilter";
import type { PeriodKey } from "@/hooks/useDashOperacoes";

export interface CompareMetric {
  label: string;
  /** Valor no período A. */
  a: number;
  /** Valor no período B (base do delta). */
  b: number;
  /** Sufixo de unidade (ex.: "d", "%"). Ignorado quando `fmt` é fornecido. */
  unit?: string;
  /** Casas decimais para o formato padrão. Default 0. */
  decimals?: number;
  /** Direção considerada "boa" para colorir o badge. Default "up". */
  goodDirection?: "up" | "down";
  /** Formatador customizado (sobrescreve unit/decimals). */
  fmt?: (n: number) => string;
}

interface Props {
  title: string;
  caption?: string;
  periodA: PeriodKey;
  periodB: PeriodKey;
  onChangeA: (p: PeriodKey) => void;
  onChangeB: (p: PeriodKey) => void;
  metrics: CompareMetric[];
  countsA?: Partial<Record<PeriodKey, number>>;
  countsB?: Partial<Record<PeriodKey, number>>;
}

const PERIOD_LABEL: Record<PeriodKey, string> = {
  tudo: "Tudo",
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
};

const defaultFmt = (m: CompareMetric) => (n: number) => {
  const dec = m.decimals ?? 0;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}${m.unit ?? ""}`;
};

export const PeriodCompare = ({
  title,
  caption,
  periodA,
  periodB,
  onChangeA,
  onChangeB,
  metrics,
  countsA,
  countsB,
}: Props) => {
  const samePeriod = periodA === periodB;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-secondary">{title}</h3>
          {caption && (
            <p className="mt-1 font-small text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 pdf-hide">
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            A
          </span>
          <PeriodFilter value={periodA} onChange={onChangeA} counts={countsA} />
          <span className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
            vs B
          </span>
          <PeriodFilter value={periodB} onChange={onChangeB} counts={countsB} />
        </div>
      </div>

      {samePeriod && (
        <p className="mb-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-1.5 font-small text-xs text-muted-foreground">
          Selecione períodos diferentes para A e B para ver os deltas.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const fmt = m.fmt ?? defaultFmt(m);
          const diff = m.a - m.b;
          const pct = m.b !== 0 ? (diff / m.b) * 100 : null;
          const eps = (m.decimals ?? 0) > 0 ? 0.05 : 0.5;
          const isFlat = samePeriod || Math.abs(diff) < eps;
          const isUp = diff > 0;
          const good = m.goodDirection ?? "up";
          const isGood = isFlat ? null : isUp ? good === "up" : good === "down";
          const tone =
            isGood === null
              ? "bg-muted/40 text-muted-foreground"
              : isGood
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive";
          const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
          return (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-card/60 p-4"
            >
              <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                {m.label}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-numeric text-2xl font-bold text-foreground">
                  {fmt(m.a)}
                </span>
                <span className="font-small text-xs text-muted-foreground">
                  vs {fmt(m.b)}
                </span>
              </div>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-numeric text-[11px] font-semibold",
                  tone,
                )}
                title={`A (${PERIOD_LABEL[periodA]}) − B (${PERIOD_LABEL[periodB]})`}
              >
                <Icon className="h-3 w-3" />
                {isFlat ? "—" : `${isUp ? "+" : ""}${fmt(diff)}`}
                {!isFlat && pct !== null && (
                  <> ({isUp ? "+" : ""}{pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</>
                )}
              </span>
              <p className="mt-1 font-small text-[10px] text-muted-foreground">
                A: {PERIOD_LABEL[periodA]} · B: {PERIOD_LABEL[periodB]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
