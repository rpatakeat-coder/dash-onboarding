import { Trophy, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL, type OperatorStat } from "@/hooks/useDashOperacoes";
import { METAS } from "@/lib/metas";

interface Props {
  operadores: OperatorStat[];
  onOperatorClick?: (op: OperatorStat) => void;
}

interface Row {
  op: OperatorStat;
  pctNoPrazo: number;
  pctCritico: number;
  noPrazo: number;
  estourado: number;
}

export const RankingTable = ({ operadores, onOperatorClick }: Props) => {
  if (!operadores.length) return null;

  const rows: Row[] = operadores.map((op) => {
    const noPrazo = op.bands.saudavel + op.bands.alerta;
    const estourado = op.bands.atencao + op.bands.critico;
    const pctNoPrazo = op.ativos ? (noPrazo / op.ativos) * 100 : 0;
    const pctCritico = op.ativos ? (op.bands.critico / op.ativos) * 100 : 0;
    return { op, pctNoPrazo, pctCritico, noPrazo, estourado };
  });

  // Ordena por pctNoPrazo desc (melhores primeiro)
  rows.sort((a, b) => b.pctNoPrazo - a.pctNoPrazo);

  const mediaSla =
    rows.reduce((s, r) => s + r.op.tempoMedio * r.op.ativos, 0) /
    Math.max(1, rows.reduce((s, r) => s + r.op.ativos, 0));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Ranking & metas por ativador
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Meta: {METAS.slaNoPrazo}% no prazo · até {METAS.maxCritico}% crítico · SLA médio do time {mediaSla.toFixed(1)}d
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Ativador</th>
              <th className="px-3 py-2 text-right">Ativos</th>
              <th className="px-3 py-2 text-right">% no prazo</th>
              <th className="px-3 py-2 text-right">% crítico</th>
              <th className="px-3 py-2 text-right">SLA médio</th>
              <th className="px-3 py-2 text-right">vs. meta SLA</th>
              <th className="px-3 py-2 text-right">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const meta = r.pctNoPrazo - METAS.slaNoPrazo;
              const okMeta = meta >= 0;
              const slaDelta = r.op.tempoMedio - mediaSla;
              return (
                <tr
                  key={r.op.nome}
                  onClick={() => onOperatorClick?.(r.op)}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    onOperatorClick && "cursor-pointer",
                  )}
                >
                  <td className="px-3 py-2 font-numeric font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground">{r.op.nome}</td>
                  <td className="px-3 py-2 text-right font-numeric tabular-nums">{r.op.ativos}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "font-numeric font-bold tabular-nums",
                        okMeta ? "text-success" : "text-destructive",
                      )}>
                        {r.pctNoPrazo.toFixed(0)}%
                      </span>
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            okMeta ? "bg-success" : "bg-destructive",
                          )}
                          style={{ width: `${Math.min(100, r.pctNoPrazo)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right font-numeric tabular-nums",
                    r.pctCritico > METAS.maxCritico ? "font-bold text-destructive" : "text-muted-foreground",
                  )}>
                    {r.pctCritico.toFixed(0)}%
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right font-numeric tabular-nums",
                    r.op.tempoMedio > METAS.tempoMedioMax ? "text-destructive font-semibold" : "text-foreground",
                  )}>
                    {r.op.tempoMedio.toFixed(1)}d
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1 font-numeric text-xs font-semibold tabular-nums",
                      okMeta ? "text-success" : "text-destructive",
                    )}>
                      {okMeta ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {meta >= 0 ? "+" : ""}{meta.toFixed(0)}pp
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-numeric font-semibold tabular-nums text-foreground">
                        {fmtBRL(r.op.mrr)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-numeric text-[11px] text-muted-foreground">
                        {Math.abs(slaDelta) < 0.5 ? (
                          <Minus className="h-2.5 w-2.5" />
                        ) : slaDelta > 0 ? (
                          <ArrowUp className="h-2.5 w-2.5 text-destructive" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5 text-success" />
                        )}
                        {slaDelta >= 0 ? "+" : ""}{slaDelta.toFixed(1)}d vs. time
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
