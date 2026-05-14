import { Package, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  computeSlaCriacaoKpis,
  fmtPct,
  type DashRow,
  type PerfilStat,
} from "@/hooks/useDashOperacoes";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";

interface Props {
  rows: DashRow[];
  perfis: PerfilStat[];
  onTotalClick?: () => void;
}

const PERFIL_COLOR: Record<string, string> = {
  P: "text-success",
  M: "text-warning",
  G: "text-destructive",
  GG: "text-secondary",
};

export const MacroEstoque = ({ rows, perfis, onTotalClick }: Props) => {
  const k = computeSlaCriacaoKpis(rows);

  return (
    <section className="space-y-4">
      {/* Linha A: Estoque + perfis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="relative">
          <div className="absolute right-2 top-2 z-10">
            <InfoTooltip text="Estoque atual = todos os deals atualmente no pipeline 'Onboarding' (filtros aplicados), independente da data de criação." />
          </div>
          <button
            type="button"
            onClick={onTotalClick}
            className="w-full rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md-soft"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  Estoque atual
                </p>
                <p className="mt-2 font-numeric text-4xl font-bold text-primary">
                  {k.total.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 font-small text-xs text-muted-foreground">
                  no pipeline Onboarding
                </p>
              </div>
              <Package className="h-6 w-6 text-primary/70" />
            </div>
          </button>
        </div>

        {(["P", "M", "G", "GG"] as const).map((p) => {
          const v = perfis.find((x) => x.perfil === p);
          return (
            <div key={p} className="relative rounded-2xl border border-border bg-card p-5">
              <div className="absolute right-2 top-2">
                <InfoTooltip text={`Perfil ${p} = quantidade de deals cujo campo perfil_cliente começa com "${p}". O percentual é (count / estoque total filtrado) × 100.`} />
              </div>
              <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                Perfil {p}
              </p>
              <p className={cn("mt-2 font-numeric text-4xl font-bold", PERFIL_COLOR[p])}>
                {v?.count ?? 0}
              </p>
              <p className="mt-1 font-small text-xs text-muted-foreground">
                {fmtPct(v?.pct ?? 0, 1)} do estoque
              </p>
            </div>
          );
        })}
      </div>

      {/* Linha B: SLA por criação */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-secondary">
              SLA do estoque (data de criação)
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Dias desde a criação do deal · cálculo bruto
            </p>
          </div>
          <InfoTooltip text="Cálculo usa sla_dias_real, que já desconta o tempo em que o card permaneceu na etapa 'Processo Pausado'. Quando sla_dias_real não estiver disponível, usa sla_dias_etapa como fallback." />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="relative rounded-xl border border-border bg-card/60 p-4">
            <div className="absolute right-2 top-2"><InfoTooltip text="P75 SLA = percentil 75 de sla_dias_real do estoque filtrado. sla_dias_real = dias desde a criação do deal DESCONTANDO o tempo em que o card permaneceu na etapa 'Processo Pausado'. 75% dos deals possuem SLA menor ou igual a esse valor." /></div>
            <p className="font-subtitle text-xs text-muted-foreground">P75 SLA</p>
            <p className="mt-2 font-numeric text-3xl font-bold text-foreground">
              {k.p75.toFixed(0)}<span className="ml-1 text-base font-medium text-muted-foreground">d</span>
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              75% dos deals têm até {k.p75.toFixed(0)} dias
            </p>
          </div>

          <div className="relative rounded-xl border border-border bg-card/60 p-4">
            <div className="absolute right-2 top-2"><InfoTooltip text="SLA médio = média aritmética de sla_dias_real em todos os deals do estoque filtrado. sla_dias_real desconta o tempo em que o card ficou na etapa 'Processo Pausado'." /></div>
            <p className="font-subtitle text-xs text-muted-foreground">SLA médio</p>
            <p className="mt-2 font-numeric text-3xl font-bold text-foreground">
              {k.media.toFixed(1)}<span className="ml-1 text-base font-medium text-muted-foreground">d</span>
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              média do estoque
            </p>
          </div>

          <div className="relative rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="font-subtitle text-xs text-muted-foreground">% acima de 30d</p>
              <div className="flex items-center gap-1.5">
                <InfoTooltip text="% acima de 30d = (deals com sla_dias_real > 30 / total filtrado) × 100. sla_dias_real já desconta o tempo em 'Processo Pausado'. Indica volume estourado no funil." />
                <AlertTriangle className="h-4 w-4 text-destructive/70" />
              </div>
            </div>
            <p className="mt-2 font-numeric text-3xl font-bold text-destructive">
              {fmtPct(k.pctAcima30, 1)}
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              {k.countAcima30.toLocaleString("pt-BR")} deals
            </p>
          </div>

          <div className="relative rounded-xl border border-success/30 bg-success/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="font-subtitle text-xs text-muted-foreground">% abaixo de 30d</p>
              <div className="flex items-center gap-1.5">
                <InfoTooltip text="% abaixo de 30d = (deals com sla_dias_real ≤ 30 / total filtrado) × 100. sla_dias_real já desconta o tempo em 'Processo Pausado'. Indica volume saudável no funil." />
                <ShieldCheck className="h-4 w-4 text-success/70" />
              </div>
            </div>
            <p className="mt-2 font-numeric text-3xl font-bold text-success">
              {fmtPct(k.pctAbaixo30, 1)}
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              {k.countAbaixo30.toLocaleString("pt-BR")} deals
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
