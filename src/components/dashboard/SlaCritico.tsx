import { Flame } from "lucide-react";
import { StalledRow } from "@/hooks/useDashOperacoes";

interface Props {
  criticos: StalledRow[];
}

export const SlaCritico = ({ criticos }: Props) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <Flame className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              SLA crítico
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Acima de 30 dias na fase atual — ação imediata
            </p>
          </div>
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 font-subtitle text-xs font-bold text-destructive">
          {criticos.length} clientes
        </span>
      </div>
      <div className="space-y-2">
        {criticos.length === 0 && (
          <p className="font-small text-sm text-muted-foreground">Nenhum SLA crítico no momento.</p>
        )}
        {criticos.map((c, i) => {
          const intensity = Math.min(100, (c.dias / 90) * 100);
          return (
            <div key={c.cliente + i} className="rounded-xl border border-destructive/15 bg-destructive/[0.03] p-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                    {c.cliente}
                  </p>
                  <p className="truncate font-small text-xs text-muted-foreground">
                    {c.ativador} · {c.etapa}
                  </p>
                </div>
                <span className="shrink-0 font-numeric text-lg font-bold text-destructive">
                  {Math.round(c.dias)}d
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-warning to-destructive"
                  style={{ width: `${intensity}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
