import { Users } from "lucide-react";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
}

export const CarteiraPorAtivador = ({ rows }: Props) => {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.agente_ativacao?.trim() || "Sem responsável";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const lista = [...map.entries()]
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count);

  const total = rows.length;
  const max = lista[0]?.count ?? 1;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            Carteira por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {lista.length} ativador(es) · {total.toLocaleString("pt-BR")} clientes
          </p>
        </div>
        <Users className="h-5 w-5 text-primary/70" />
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-2">
        {lista.length === 0 && (
          <p className="font-small text-sm text-muted-foreground">Sem dados.</p>
        )}
        {lista.map((op, i) => {
          const pct = (op.count / max) * 100;
          return (
            <div
              key={op.nome}
              className="rounded-lg border border-transparent p-2 transition hover:border-border hover:bg-muted/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-numeric text-xs font-bold text-muted-foreground w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-subtitle text-sm font-semibold text-foreground truncate">
                    {op.nome}
                  </span>
                </div>
                <span className="shrink-0 font-numeric text-sm font-bold text-foreground tabular-nums">
                  {op.count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
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
