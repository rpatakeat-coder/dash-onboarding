import { Users, DollarSign, UserCog } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { fmtBRL, type CarteiraAgente } from "@/hooks/useDashSucesso";

interface Props {
  agentes: CarteiraAgente[];
  totalClientes: number;
  totalMrr: number;
  /** Conjunto de agentes atualmente selecionados no filtro compartilhado. */
  selectedAgentes?: Set<string>;
  /** Toggle do agente no filtro compartilhado. */
  onToggleAgente?: (agente: string) => void;
  /** Limpa o filtro de agentes. */
  onClearAgentes?: () => void;
}

const fmtN = (n: number) => n.toLocaleString("pt-BR");

export const CarteiraPorAgente = ({
  agentes,
  totalClientes,
  totalMrr,
  selectedAgentes,
  onToggleAgente,
  onClearAgentes,
}: Props) => {
  const sumClientes = agentes.reduce((s, a) => s + a.clientes, 0);
  const sumMrr = agentes.reduce((s, a) => s + a.mrr, 0);
  const hasSelection = !!selectedAgentes && selectedAgentes.size > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Distribuição por Carteira
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Clique em um agente para filtrar a página inteira.
            </p>
          </div>
        </div>
        {hasSelection && onClearAgentes && (
          <button
            onClick={onClearAgentes}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Filtro ativo: <span className="text-foreground">{selectedAgentes!.size} agente(s)</span> · limpar ✕
          </button>
        )}
      </div>

      {/* KPIs de topo, clicáveis (padrão Onboarding) — clicar limpa o filtro de agentes */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "Clientes na Carteira", value: fmtN(sumClientes), icon: Users, tone: "primary" as const },
          { label: "MRR Total da Carteira", value: fmtBRL(sumMrr), icon: DollarSign, tone: "success" as const },
          { label: "Agentes Ativos", value: fmtN(agentes.length), icon: UserCog, tone: "secondary" as const },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={onClearAgentes}
            disabled={!hasSelection}
            aria-pressed={!hasSelection}
            className={`text-left rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              !hasSelection ? "ring-1 ring-primary/20" : "hover:-translate-y-0.5"
            }`}
            title={hasSelection ? "Limpar filtro de agentes" : "Sem filtro de agentes ativo"}
          >
            <KpiCard label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
          </button>
        ))}
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
            {agentes.map((a, idx) => {
              const isActive = !!selectedAgentes?.has(a.agente);
              return (
                <tr
                  key={a.agente}
                  onClick={() => onToggleAgente?.(a.agente)}
                  role={onToggleAgente ? "button" : undefined}
                  tabIndex={onToggleAgente ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!onToggleAgente) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleAgente(a.agente);
                    }
                  }}
                  aria-pressed={isActive}
                  className={`cursor-pointer transition ${
                    isActive
                      ? "bg-primary/10 hover:bg-primary/15"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <td className="px-3 py-2.5 font-numeric text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {isActive && <span className="mr-1.5 text-primary">●</span>}
                    {a.agente}
                  </td>
                  <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.clientes)}</td>
                  <td className="px-3 py-2.5 text-right font-numeric font-semibold">{fmtBRL(a.mrr)}</td>
                  <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.qtdPM)}</td>
                  <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">{fmtBRL(a.mrrPM)}</td>
                  <td className="px-3 py-2.5 text-right font-numeric">{fmtN(a.qtdGGG)}</td>
                  <td className="px-3 py-2.5 text-right font-numeric text-muted-foreground">{fmtBRL(a.mrrGGG)}</td>
                </tr>
              );
            })}
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
