import { AlertOctagon, AlertTriangle, PauseCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/hooks/useDashOperacoes";
import { DealLink } from "./DealLink";

interface Props {
  atencao: { etapa: string; count: number; mrr: number; tone: "danger" | "warning" }[];
  topMrrTravado: { id: number; cliente: string; ativador: string; etapa: string; dias: number; mrr: number }[];
}

const ICON_MAP: Record<string, typeof AlertOctagon> = {
  "Pré-Cancelamento": XCircle,
  "Inativo": AlertOctagon,
  "Pendências": AlertTriangle,
  "Processo Pausado": PauseCircle,
};

export const AttentionPoints = ({ atencao, topMrrTravado }: Props) => {
  const totalCriticos = atencao.reduce((s, a) => s + a.count, 0);
  const mrrEmRisco = atencao.reduce((s, a) => s + a.mrr, 0);

  return (
    <div className="rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/[0.04] to-warning/[0.04] p-6 shadow-sm-soft">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Pontos de atenção
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              {totalCriticos} clientes em situação crítica · {fmtBRL(mrrEmRisco)} em risco
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Cards de etapas críticas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-3 lg:grid-cols-2">
          {atencao.map((a) => {
            const Icon = ICON_MAP[a.etapa] ?? AlertTriangle;
            const isDanger = a.tone === "danger";
            return (
              <div
                key={a.etapa}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md-soft",
                  isDanger ? "border-destructive/30" : "border-warning/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-subtitle text-xs text-muted-foreground">{a.etapa}</p>
                    <p className={cn(
                      "mt-2 font-numeric text-3xl font-bold",
                      isDanger ? "text-destructive" : "text-warning"
                    )}>
                      {a.count}
                    </p>
                    <p className="mt-1 font-small text-xs text-muted-foreground">
                      {fmtBRL(a.mrr)} MRR
                    </p>
                  </div>
                  <Icon className={cn(
                    "h-5 w-5",
                    isDanger ? "text-destructive" : "text-warning"
                  )} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top MRR em risco */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            Maior MRR travado
          </p>
          <ul className="mt-3 space-y-2.5">
            {topMrrTravado.length === 0 && (
              <li className="font-small text-sm text-muted-foreground">Sem MRR travado 🎉</li>
            )}
            {topMrrTravado.map((c, i) => (
              <li key={c.cliente + i} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-subtitle text-sm font-semibold text-foreground">
                    <DealLink id={c.id}>{c.cliente}</DealLink>
                  </p>
                  <p className="truncate font-small text-xs text-muted-foreground">
                    {c.ativador} · {c.etapa}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-numeric text-sm font-bold text-primary">{fmtBRL(c.mrr)}</p>
                  <p className="font-numeric text-[11px] text-destructive">{c.dias.toFixed(0)}d</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
