import { AlertTriangle, Clock } from "lucide-react";
import { StalledRow } from "@/hooks/useDashOperacoes";
import { DealLink } from "./DealLink";
import { DataCard, DataCardHeader, DataCardRow } from "@/components/ui/DataCard";

interface Props {
  travados: StalledRow[];
  onRowClick?: (id: number) => void;
}

export const StalledTable = ({ travados, onRowClick }: Props) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Onboardings travados
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Mais de 7 dias na mesma fase
            </p>
          </div>
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 font-subtitle text-xs font-bold text-destructive">
          {travados.length} críticos
        </span>
      </div>
      <div className="hidden -mx-1 overflow-x-auto rounded-xl border border-border sm:mx-0 md:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">Restaurante</th>
              <th className="px-4 py-3 text-left">Ativador</th>
              <th className="px-4 py-3 text-left">Etapa</th>
              <th className="px-4 py-3 text-right">Parado há</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {travados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-small text-sm text-muted-foreground">
                  Nenhum onboarding travado. Time no controle! 🎉
                </td>
              </tr>
            )}
            {travados.map((a) => (
              <tr
                key={a.cliente + a.etapa}
                onClick={() => onRowClick?.(a.id)}
                className={`transition-colors hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""}`}
              >
                <td className="px-4 py-3 font-semibold text-foreground"><DealLink id={a.id}>{a.cliente}</DealLink></td>
                <td className="px-4 py-3 text-muted-foreground">{a.ativador}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-secondary/10 px-2 py-0.5 font-subtitle text-xs font-medium text-secondary">
                    {a.etapa}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-numeric font-bold text-destructive">
                    <Clock className="h-3.5 w-3.5" />
                    {a.dias.toFixed(1)}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {travados.length === 0 && (
          <p className="py-6 text-center font-small text-sm text-muted-foreground">Nenhum onboarding travado. Time no controle! 🎉</p>
        )}
        {travados.map((a) => (
          <button key={a.cliente + a.etapa} type="button" onClick={() => onRowClick?.(a.id)} className={`block w-full text-left ${onRowClick ? "" : "cursor-default"}`}>
            <DataCard>
              <DataCardHeader right={<span className="inline-flex items-center gap-1 font-numeric font-bold text-destructive"><Clock className="h-3.5 w-3.5" />{a.dias.toFixed(1)}d</span>}>
                <DealLink id={a.id}>{a.cliente}</DealLink>
              </DataCardHeader>
              <DataCardRow label="Ativador">{a.ativador}</DataCardRow>
              <DataCardRow label="Etapa">
                <span className="rounded-md bg-secondary/10 px-2 py-0.5 font-subtitle text-xs font-medium text-secondary">{a.etapa}</span>
              </DataCardRow>
            </DataCard>
          </button>
        ))}
      </div>
    </div>
  );
};
