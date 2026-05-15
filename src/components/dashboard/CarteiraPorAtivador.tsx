import { AlertTriangle, Users } from "lucide-react";
import type { DashRow } from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashRow[];
}

const SEM_RESP = "Sem responsável";

export const CarteiraPorAtivador = ({ rows }: Props) => {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.agente_ativacao?.trim() || SEM_RESP;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const lista = [...map.entries()]
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count);

  const total = rows.length;
  const max = lista[0]?.count ?? 1;
  const semRespCount = map.get(SEM_RESP) ?? 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-secondary">
            Carteira por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {lista.length} ativador(es) · {total.toLocaleString("pt-BR")} clientes
          </p>
        </div>
        <Users className="h-5 w-5 shrink-0 text-primary/70" />
      </div>

      {semRespCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="font-subtitle text-xs text-foreground">
            <span className="font-bold">{semRespCount}</span>{" "}
            {semRespCount === 1 ? "deal está" : "deals estão"} sem ativador responsável.
          </p>
        </div>
      )}

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-2">
        {lista.length === 0 && (
          <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
        )}
        {lista.map((op, i) => {
          const pct = (op.count / max) * 100;
          const isSemResp = op.nome === SEM_RESP;
          return (
            <div
              key={op.nome}
              className={cn(
                "rounded-lg border p-2 transition",
                isSemResp
                  ? "border-warning/30 bg-warning/[0.06] hover:bg-warning/10"
                  : "border-transparent hover:border-border hover:bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-numeric text-xs font-bold text-muted-foreground w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "font-subtitle text-sm font-semibold truncate",
                      isSemResp ? "text-warning" : "text-foreground",
                    )}
                  >
                    {op.nome}
                  </span>
                  {isSemResp && (
                    <span className="shrink-0 rounded-full border border-warning/40 bg-warning/15 px-1.5 py-0.5 font-subtitle text-[9px] font-bold uppercase tracking-wider text-warning">
                      Sem dono
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 font-numeric text-sm font-bold tabular-nums",
                    isSemResp ? "text-warning" : "text-foreground",
                  )}
                >
                  {op.count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isSemResp ? "bg-warning" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

