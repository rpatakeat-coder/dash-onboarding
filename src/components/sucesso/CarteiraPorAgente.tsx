import { Users } from "lucide-react";
import { fmtBRL, type CarteiraAgente } from "@/hooks/useDashSucesso";

interface Props {
  agentes: CarteiraAgente[];
  totalClientes: number;
  totalMrr: number;
}

const fmtN = (n: number) => n.toLocaleString("pt-BR");

export const CarteiraPorAgente = ({ agentes, totalClientes, totalMrr }: Props) => {
  // Recompute MRR per group from rows isn't available; CarteiraAgente already has per-group qty.
  // For per-group MRR we extend in the parent — but here we only render what's provided.
  const sumClientes = agentes.reduce((s, a) => s + a.clientes, 0);
  const sumMrr = agentes.reduce((s, a) => s + a.mrr, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Distribuição por Carteira
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            {fmtN(sumClientes)} clientes · {fmtBRL(sumMrr)} em MRR · {agentes.length} agentes
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Agente</th>
              <th className="px-3 py-2 text-right">Clientes</th>
              <th className="px-3 py-2 text-right">MRR Total</th>
              <th className="px-3 py-2 text-right">P+M (qtd)</th>
              <th className="px-3 py-2 text-right">P+M (MRR)</th>
              <th className="px-3 py-2 text-right">G+GG (qtd)</th>
              <th className="px-3 py-2 text-right">G+GG (MRR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agentes.map((a, idx) => (
              <tr key={a.agente} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 font-numeric text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{a.agente}</td>
                <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.clientes)}</td>
                <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(a.mrr)}</td>
                <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.qtdPM)}</td>
                <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">{fmtBRL(a.mrrPM)}</td>
                <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.qtdGGG)}</td>
                <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">{fmtBRL(a.mrrGGG)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr className="font-subtitle text-xs text-foreground">
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 font-semibold">Total</td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold">
                {fmtN(sumClientes)}
                {totalClientes > 0 && sumClientes !== totalClientes && (
                  <span className="ml-1 text-[10px] text-warning">
                    (overview: {fmtN(totalClientes)})
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold">
                {fmtBRL(sumMrr)}
                {totalMrr > 0 && Math.abs(sumMrr - totalMrr) > 1 && (
                  <span className="ml-1 text-[10px] text-warning">
                    (overview: {fmtBRL(totalMrr)})
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold">
                {fmtN(agentes.reduce((s, a) => s + a.qtdPM, 0))}
              </td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold text-muted-foreground">
                {fmtBRL(agentes.reduce((s, a) => s + a.mrrPM, 0))}
              </td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold">
                {fmtN(agentes.reduce((s, a) => s + a.qtdGGG, 0))}
              </td>
              <td className="px-3 py-2.5 text-right font-numeric font-semibold text-muted-foreground">
                {fmtBRL(agentes.reduce((s, a) => s + a.mrrGGG, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
