import { Trophy } from "lucide-react";
import { OperatorStat, fmtBRL } from "@/hooks/useDashOperacoes";

interface Props {
  operadores: OperatorStat[];
}

export const OperatorsTable = ({ operadores }: Props) => {
  const max = Math.max(1, ...operadores.map((o) => o.ativos));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Performance por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Onboardings ativos, MRR no funil e tempo médio na fase
          </p>
        </div>
        <Trophy className="h-5 w-5 text-warning" />
      </div>
      <div className="space-y-4 max-h-[340px] overflow-y-auto pr-2">
        {operadores.length === 0 && (
          <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
        )}
        {operadores.map((op, i) => (
          <div key={op.nome} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-numeric text-xs font-bold text-muted-foreground w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-subtitle font-semibold text-foreground truncate">
                  {op.nome}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3 font-numeric text-xs text-muted-foreground">
                <span><span className="font-bold text-foreground">{op.ativos}</span> ativos</span>
                <span className="hidden sm:inline"><span className="font-bold text-foreground">{fmtBRL(op.mrr)}</span></span>
                <span><span className="font-bold text-foreground">{op.tempoMedio.toFixed(1)}d</span></span>
                {op.travados > 0 && (
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-bold text-destructive">
                    {op.travados} travados
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-primary transition-all"
                style={{ width: `${(op.ativos / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
