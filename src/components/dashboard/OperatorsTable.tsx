import { useState } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { OperatorStat, fmtBRL } from "@/hooks/useDashOperacoes";
import { SlaBandBar } from "./SlaBandBar";
import { cn } from "@/lib/utils";
import { OperatorInsightDialog } from "./OperatorInsightDialog";

interface Props {
  operadores: OperatorStat[];
  onOperatorClick?: (op: OperatorStat) => void;
  /** Aggregated KPIs sent as context to the AI per-operator analysis. */
  contextoOperacao?: Record<string, string | number>;
  scopeKey?: string;
}

export const OperatorsTable = ({ operadores, onOperatorClick, contextoOperacao, scopeKey }: Props) => {
  const [aiTarget, setAiTarget] = useState<OperatorStat | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Performance por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Carteira por SLA · clique para ver detalhe do operador
          </p>
        </div>
        <Trophy className="h-5 w-5 text-warning" />
      </div>
      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
        {operadores.length === 0 && (
          <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
        )}
        {operadores.map((op, i) => {
          const interactive = !!onOperatorClick;
          const hasCriticos = op.bands.critico > 0;
          return (
            <div
              key={op.nome}
              onClick={() => onOperatorClick?.(op)}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onOperatorClick?.(op);
                }
              }}
              className={cn(
                "group relative space-y-2 rounded-xl border p-3 transition",
                hasCriticos ? "border-destructive/30" : "border-transparent",
                interactive && "cursor-pointer hover:border-primary/40 hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAiTarget(op);
                }}
                className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground opacity-0 transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus:opacity-100"
                title="Analisar este operador com IA"
                aria-label="Analisar este operador com IA"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center justify-between gap-3 pr-8 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-numeric text-xs font-bold text-muted-foreground w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-subtitle font-semibold text-foreground truncate">
                    {op.nome}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 font-numeric text-xs text-muted-foreground">
                  <span>
                    <span className="font-bold text-foreground">{op.ativos}</span> ativos
                  </span>
                  <span className="hidden sm:inline">
                    <span className="font-bold text-foreground">{fmtBRL(op.mrr)}</span>
                  </span>
                  <span>
                    <span className="font-bold text-foreground">{op.tempoMedio.toFixed(1)}d</span>
                  </span>
                </div>
              </div>

              <SlaBandBar bands={op.bands} height="md" />

              <div className="flex flex-wrap gap-1.5">
                {(["critico", "atencao", "alerta", "saudavel"] as const).map((k) => {
                  const v = op.bands[k];
                  if (v === 0) return null;
                  const cssVar = {
                    critico: "--sla-critico",
                    atencao: "--sla-atencao",
                    alerta: "--sla-alerta",
                    saudavel: "--sla-saudavel",
                  }[k];
                  return (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-numeric text-[10px] font-bold tabular-nums"
                      style={{
                        backgroundColor: `hsla(var(${cssVar}), 0.12)`,
                        color: `hsl(var(${cssVar}))`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: `hsl(var(${cssVar}))` }}
                      />
                      {v}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
