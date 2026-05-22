import { useState } from "react";
import { TrendingUp, TrendingDown, Calendar, CalendarDays, DollarSign } from "lucide-react";
import {
  fmtBRL,
  fmtBRLk,
  fmtPct,
  getPeriodRanges,
  mrrAtivadoNoPeriodo,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
import { MrrAtivadoMesModal } from "./MrrAtivadoMesModal";

interface Props {
  rows: DashRow[];
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type BigPeriod = "hoje" | "semana" | "mes" | "tudo";

export const MrrAtivadoKpis = ({ rows }: Props) => {
  const r = getPeriodRanges();
  const [modalPeriod, setModalPeriod] = useState<BigPeriod | null>(null);
  const [bigPeriod, setBigPeriod] = useState<BigPeriod>("mes");
  const mrrTotalEstoque = rows.reduce((s, x) => s + num(x.mrr), 0);

  const hoje = mrrAtivadoNoPeriodo(rows, r.todayStart, r.tomorrow);
  const semana = mrrAtivadoNoPeriodo(rows, r.weekStart, r.nextWeek);
  const mes = mrrAtivadoNoPeriodo(rows, r.monthStart, r.nextMonth);
  const mesAnt = mrrAtivadoNoPeriodo(rows, r.lastMonthStart, r.monthStart);
  const tudo = mrrAtivadoNoPeriodo(rows, new Date(0), new Date(8640000000000000));

  const bigMap: Record<BigPeriod, { data: { mrr: number; count: number }; label: string; sub: string }> = {
    hoje: { data: hoje, label: "Hoje", sub: "ativações de hoje" },
    semana: { data: semana, label: "Esta semana", sub: "seg → dom" },
    mes: { data: mes, label: "", sub: "" },
    tudo: { data: tudo, label: "Tudo", sub: "histórico completo" },
  };

  const pct = (v: number) => (mrrTotalEstoque > 0 ? (v / mrrTotalEstoque) * 100 : 0);

  const pctHoje = pct(hoje.mrr);
  const pctSemana = pct(semana.mrr);
  const pctMes = pct(mes.mrr);
  const pctMesAnt = pct(mesAnt.mrr);

  const deltaMrr = mesAnt.mrr > 0 ? ((mes.mrr - mesAnt.mrr) / mesAnt.mrr) * 100 : mes.mrr > 0 ? 100 : 0;
  const deltaPp = pctMes - pctMesAnt;

  const mesLabelRaw = r.monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1).replace(" de ", "/");

  const modalRanges: Record<BigPeriod, { start: Date; end: Date; titulo: string; descricao: string }> = {
    hoje: {
      start: r.todayStart,
      end: r.tomorrow,
      titulo: "MRR Ativado · Hoje",
      descricao: "Ativações registradas hoje",
    },
    semana: {
      start: r.weekStart,
      end: r.nextWeek,
      titulo: "MRR Ativado · Esta semana",
      descricao: "Ativações de segunda a domingo",
    },
    mes: {
      start: r.monthStart,
      end: r.nextMonth,
      titulo: `MRR Ativado · ${mesLabel}`,
      descricao: "Detalhamento das ativações do mês vigente",
    },
    tudo: {
      start: new Date(0),
      end: new Date(8640000000000000),
      titulo: "MRR Ativado · Tudo",
      descricao: "Histórico completo de ativações",
    },
  };

  const cards = [
    {
      key: "hoje",
      label: "% MRR Ativado · Hoje",
      icon: Calendar,
      pct: pctHoje,
      mrr: hoje.mrr,
      count: hoje.count,
      accent: "text-primary",
      border: "border-primary/30",
      bg: "bg-primary/[0.04]",
      sub: `${fmtBRLk(hoje.mrr)} · ${hoje.count} ativ.`,
      formula: "Soma do MRR dos deals ativados hoje (data_ativacao = hoje) ÷ MRR total do estoque filtrado × 100.",
    },
    {
      key: "semana",
      label: "% MRR Ativado · Semana",
      icon: CalendarDays,
      pct: pctSemana,
      mrr: semana.mrr,
      count: semana.count,
      accent: "text-foreground",
      border: "border-border",
      bg: "bg-card",
      sub: `${fmtBRLk(semana.mrr)} · ${semana.count} ativ.`,
      formula: "Soma do MRR dos deals ativados nesta semana (segunda → domingo) ÷ MRR total do estoque filtrado × 100.",
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm-soft">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            % MRR Ativado
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Percentual do MRR do estoque que foi ativado no período
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setModalPeriod(c.key as BigPeriod)}
              className={cn(
                "group relative rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md-soft",
                c.border,
                c.bg,
              )}
            >
              <div className="flex items-start justify-between">
                <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
                <div className="flex items-center gap-1.5">
                  <InfoTooltip text={c.formula} />
                  <Icon className={cn("h-4 w-4 opacity-70", c.accent)} />
                </div>
              </div>
              <p className={cn("mt-2 font-numeric text-3xl font-bold", c.accent)}>
                {fmtPct(c.pct, 1)}
              </p>
              <p className="mt-1 font-small text-xs text-muted-foreground">{c.sub}</p>
              <span className="pdf-hide mt-1 inline-block font-small text-[10px] text-primary/0 transition group-hover:text-primary">
                Clique para detalhar →
              </span>
            </button>
          );
        })}

        {/* MRR Ativado · período selecionável (mês → clicável p/ drill-down) */}
        {(() => {
          const cur = bigMap[bigPeriod].data;
          const isMes = bigPeriod === "mes";
          const headerLabel = isMes ? mesLabel : bigMap[bigPeriod].label;
          const subText =
            cur.count > 0
              ? `${headerLabel} · ${cur.count} ativ${cur.count === 1 ? "ação" : "ações"}`
              : `${headerLabel} · Nenhuma ativação`;
          const PERIODS: { key: BigPeriod; label: string }[] = [
            { key: "hoje", label: "Hoje" },
            { key: "semana", label: "Semana" },
            { key: "mes", label: "Mês" },
            { key: "tudo", label: "Tudo" },
          ];
          return (
            <div className="group relative rounded-xl border border-success/30 bg-success/[0.04] p-4">
              <div className="flex items-start justify-between">
                <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  MRR Ativado
                </p>
                <div className="flex items-center gap-1.5">
                  <InfoTooltip text="Soma do MRR dos deals cuja data de ativação cai no período selecionado. No modo 'Mês', clique no valor para ver o detalhamento por agente, perfil e lista de deals." />
                  <DollarSign className="h-4 w-4 text-success/70" />
                </div>
              </div>
              <div className="pdf-hide mt-2 inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setBigPeriod(p.key)}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-subtitle text-[10px] font-semibold transition",
                      bigPeriod === p.key
                        ? "bg-success text-success-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {isMes ? (
                <button
                  type="button"
                  onClick={() => setMesModalOpen(true)}
                  className="mt-1 block w-full text-left transition hover:opacity-80"
                >
                  <p className="font-numeric text-3xl font-bold text-success">
                    {fmtBRL(cur.mrr)}
                  </p>
                  <p className="mt-1 font-small text-xs text-muted-foreground">{subText}</p>
                  <span className="pdf-hide mt-1 inline-block font-small text-[10px] text-primary/0 transition group-hover:text-primary">
                    Clique para detalhar →
                  </span>
                </button>
              ) : (
                <>
                  <p className="mt-2 font-numeric text-3xl font-bold text-success">
                    {fmtBRL(cur.mrr)}
                  </p>
                  <p className="mt-1 font-small text-xs text-muted-foreground">{subText}</p>
                </>
              )}
            </div>
          );
        })()}

        {/* Mês atual vs anterior */}
        <div className="relative rounded-xl border border-secondary/30 bg-secondary/[0.04] p-4">
          <div className="flex items-start justify-between">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Mês atual vs. anterior
            </p>
            <div className="flex items-center gap-1.5">
              <InfoTooltip text="Variação % do MRR ativado: ((MRR ativado mês atual − MRR ativado mês anterior) ÷ MRR mês anterior) × 100. O p.p. ao lado é a diferença em pontos percentuais do % MRR Ativado entre os dois meses." />
              {deltaMrr >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success/80" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive/80" />
              )}
            </div>
          </div>
          <p
            className={cn(
              "mt-2 font-numeric text-3xl font-bold",
              deltaMrr >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {deltaMrr >= 0 ? "+" : ""}
            {deltaMrr.toFixed(0)}%
          </p>
          <p className="mt-1 font-small text-xs text-muted-foreground">
            {fmtBRLk(mes.mrr)} vs {fmtBRLk(mesAnt.mrr)} ·{" "}
            <span className={deltaPp >= 0 ? "text-success" : "text-destructive"}>
              {deltaPp >= 0 ? "↑" : "↓"} {Math.abs(deltaPp).toFixed(1)} p.p.
            </span>
          </p>
        </div>
      </div>

      <MrrAtivadoMesModal
        open={mesModalOpen}
        onOpenChange={setMesModalOpen}
        rows={rows}
        mesLabel={mesLabel}
      />
    </section>
  );
};
