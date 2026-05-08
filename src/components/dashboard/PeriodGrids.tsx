import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodStat, PerfilStat, fmtBRLk, fmtPct } from "@/hooks/useDashOperacoes";

interface Props {
  hoje: PeriodStat;
  semana: PeriodStat;
  mes: PeriodStat;
  mesAnterior: PeriodStat;
  perfis: PerfilStat[];
}

const PERFIL_COLOR: Record<string, string> = {
  P: "text-success",
  M: "text-warning",
  G: "text-destructive",
  GG: "text-secondary",
};

const Tile = ({
  label,
  value,
  delta,
  sub,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  accent?: string;
}) => (
  <div className="rounded-xl border border-border bg-card/60 p-4">
    <p className="font-subtitle text-xs text-muted-foreground">{label}</p>
    <p className={cn("mt-2 font-numeric text-3xl font-bold leading-none", accent)}>{value}</p>
    {delta !== undefined && delta !== 0 && (
      <span
        className={cn(
          "mt-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-numeric text-[11px] font-semibold",
          delta >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}
      >
        {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
      </span>
    )}
    {sub && <p className="mt-1 font-small text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const Panel = ({
  title,
  caption,
  accent,
  children,
}: {
  title: string;
  caption: string;
  accent?: "success" | "primary";
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "rounded-2xl border bg-card p-6 shadow-sm-soft",
      accent === "success" && "border-success/30 bg-success/[0.03]",
      accent === "primary" && "border-primary/30 bg-primary/[0.03]",
      !accent && "border-border"
    )}
  >
    <div className="mb-4 flex items-end justify-between">
      <h3 className={cn(
        "font-display text-base font-semibold",
        accent === "success" ? "text-success" : accent === "primary" ? "text-primary" : "text-secondary"
      )}>
        {title}
      </h3>
      <span className="font-small text-xs text-muted-foreground">{caption}</span>
    </div>
    {children}
  </div>
);

const deltaPct = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
};

export const PeriodGrids = ({ hoje, semana, mes, mesAnterior, perfis }: Props) => {
  const novosDelta = deltaPct(mes.novos, mesAnterior.novos);
  const mrrAtivadoDelta = deltaPct(mes.mrrAtivado, mesAnterior.mrrAtivado);
  const pctAtivadoDelta = mes.pctAtivado - mesAnterior.pctAtivado;

  return (
    <div className="space-y-6">
      {/* Linha 1: Novos clientes + Distribuição por perfil */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Novos clientes" caption="entrada no funil">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Hoje" value={hoje.novos.toString()} accent="text-primary" />
            <Tile label="Esta semana" value={semana.novos.toString()} />
            <Tile label="Este mês" value={mes.novos.toString()} delta={novosDelta} />
            <Tile label="Mês passado" value={mesAnterior.novos.toString()} accent="text-muted-foreground" />
          </div>
        </Panel>

        <Panel title="Distribuição por perfil" caption="estoque atual">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {perfis.map((p) => (
              <div key={p.perfil} className="rounded-xl border border-border bg-card/60 p-4">
                <p className="font-subtitle text-xs text-muted-foreground">Perfil {p.perfil}</p>
                <p className={cn("mt-2 font-numeric text-3xl font-bold", PERFIL_COLOR[p.perfil] ?? "text-foreground")}>
                  {p.count}
                </p>
                <p className="mt-1 font-small text-xs text-muted-foreground">{fmtPct(p.pct)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* Linha 2: % MRR ativado + MRR Ativado R$ */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="% MRR ativado" caption="% do MRR previsto que virou ativação" accent="success">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Hoje" value={fmtPct(hoje.pctAtivado, 0)} accent="text-success" />
            <Tile label="Esta semana" value={fmtPct(semana.pctAtivado, 0)} accent="text-success" />
            <Tile
              label="Este mês"
              value={fmtPct(mes.pctAtivado, 0)}
              accent="text-success"
              sub={pctAtivadoDelta !== 0 ? `${pctAtivadoDelta >= 0 ? "↑" : "↓"} ${Math.abs(pctAtivadoDelta).toFixed(0)} p.p.` : undefined}
            />
            <Tile label="Mês anterior" value={fmtPct(mesAnterior.pctAtivado, 0)} accent="text-muted-foreground" />
          </div>
        </Panel>

        <Panel title="MRR ativado (R$)" caption="soma do MRR de clientes ativados" accent="primary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Hoje"
              value={fmtBRLk(hoje.mrrAtivado)}
              accent="text-primary"
              sub={`${hoje.ativados} clientes`}
            />
            <Tile
              label="Esta semana"
              value={fmtBRLk(semana.mrrAtivado)}
              accent="text-primary"
              sub={`${semana.ativados} clientes`}
            />
            <Tile
              label="Este mês"
              value={fmtBRLk(mes.mrrAtivado)}
              accent="text-primary"
              delta={mrrAtivadoDelta}
              sub={`${mes.ativados} clientes`}
            />
            <Tile
              label="Mês anterior"
              value={fmtBRLk(mesAnterior.mrrAtivado)}
              accent="text-muted-foreground"
              sub={`${mesAnterior.ativados} clientes`}
            />
          </div>
        </Panel>
      </section>
    </div>
  );
};
