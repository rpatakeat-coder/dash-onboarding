import { useMemo, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseDate,
  parseActivationDate,
  CHURN_STAGE_IDS,
  CHURN_CANCELAMENTO_PIPELINE,
  type DashRow,
} from "@/hooks/useDashOperacoes";

type PeriodKey = "semana" | "mes" | "trimestre";

interface Props {
  rows: DashRow[];
  variant?: "default" | "tv";
}

interface ScoreRow {
  ativador: string;
  pctMrr: number;
  pctClientes: number;
  pctChurn: number;
  scoreFinal: number;
  mrrAtivado: number;
  clientesAtivados: number;
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - day);
  return x;
};

const startOfQuarter = (d: Date) => {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
};

const getRanges = (period: PeriodKey) => {
  const now = new Date();
  if (period === "semana") {
    const start = startOfWeek(now);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    return { start, end, prevStart, prevEnd: start };
  }
  if (period === "trimestre") {
    const start = startOfQuarter(now);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
    return { start, end, prevStart, prevEnd: start };
  }
  // mes
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: start };
};

const computeRanking = (rows: DashRow[], period: PeriodKey): ScoreRow[] => {
  const { start, end, prevStart, prevEnd } = getRanges(period);
  const inCur = (d: Date | null) => !!d && d >= start && d < end;
  const inPrev = (d: Date | null) => !!d && d >= prevStart && d < prevEnd;

  const map = new Map<string, {
    mrrAtivado: number; mrrCriadoAnterior: number;
    clientesAtivados: number; clientesCriadosAnterior: number;
    churnReal: number;
  }>();
  const ensure = (k: string) => {
    let c = map.get(k);
    if (!c) {
      c = { mrrAtivado: 0, mrrCriadoAnterior: 0, clientesAtivados: 0, clientesCriadosAnterior: 0, churnReal: 0 };
      map.set(k, c);
    }
    return c;
  };

  for (const r of rows) {
    const agente = r.agente_ativacao?.trim();
    if (!agente) continue;
    const mrr = toNum(r.mrr);
    const dCriacao = parseDate(r.data_criacao);
    if (inPrev(dCriacao)) {
      const c = ensure(agente);
      c.mrrCriadoAnterior += mrr;
      c.clientesCriadosAnterior += 1;
    }
    if (inCur(parseActivationDate(r.data_ativacao))) {
      const c = ensure(agente);
      c.mrrAtivado += mrr;
      c.clientesAtivados += 1;
    }
    const etapa = (r.etapa_negocio ?? "").trim();
    const cancel = (r.etapa_de_cancelamento ?? "").trim().toLowerCase();
    const isChurn = CHURN_STAGE_IDS.has(etapa) || cancel === CHURN_CANCELAMENTO_PIPELINE.toLowerCase();
    if (isChurn && inCur(parseDate(r.data_fechamento))) {
      ensure(agente).churnReal += mrr;
    }
  }

  const out: ScoreRow[] = [];
  map.forEach((c, ativador) => {
    const pctMrr = c.mrrCriadoAnterior > 0 ? (c.mrrAtivado / c.mrrCriadoAnterior) * 100 : 0;
    const pctClientes = c.clientesCriadosAnterior > 0 ? (c.clientesAtivados / c.clientesCriadosAnterior) * 100 : 0;
    const churnMax = c.mrrCriadoAnterior * 0.09;
    // % Churn = quanto do teto foi consumido (real / máx × 100). Menor = melhor.
    const pctChurn = churnMax > 0 ? (c.churnReal / churnMax) * 100 : 0;
    // Penalidade só quando estoura o teto (> 100%).
    const churnPenalty = pctChurn > 100 ? (pctChurn - 100) * 10 : 0;
    const scoreFinal = Math.max(0, (pctMrr * 60 + pctClientes * 30 - churnPenalty) / 100);
    out.push({
      ativador, pctMrr, pctClientes, pctChurn, scoreFinal,
      mrrAtivado: c.mrrAtivado, clientesAtivados: c.clientesAtivados,
    });
  });

  return out
    .filter((r) => r.scoreFinal > 0 || r.mrrAtivado > 0 || r.clientesAtivados > 0)
    .sort((a, b) => b.scoreFinal - a.scoreFinal);
};

const MEDAL_STYLES = [
  { bg: "from-amber-400/30 to-amber-500/10", ring: "ring-amber-400/60", text: "text-amber-400", label: "Ouro" },
  { bg: "from-slate-300/30 to-slate-400/10", ring: "ring-slate-300/60", text: "text-slate-300", label: "Prata" },
  { bg: "from-orange-600/30 to-orange-700/10", ring: "ring-orange-500/60", text: "text-orange-400", label: "Bronze" },
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
  semana: "Semana",
  mes: "Mês",
  trimestre: "Trimestre",
};

export const RankingMetasMedalhas = ({ rows, variant = "default" }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const data = useMemo(() => computeRanking(rows, period), [rows, period]);
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  const isTv = variant === "tv";

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card shadow-sm-soft",
      isTv ? "p-6" : "p-4 sm:p-6",
    )}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className={cn("font-display font-semibold text-secondary", isTv ? "text-2xl" : "text-lg")}>
              Ranking de metas
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              Top 3 do período · Score = (60×%MRR + 30×%Cli + penalidade de churn) / 100
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeriod(k)}
              className={cn(
                "rounded-md px-3 py-1.5 font-subtitle text-xs transition",
                period === k
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center font-subtitle text-sm text-muted-foreground">
          Sem dados suficientes para o período selecionado.
        </div>
      ) : (
        <>
          <div className={cn("grid gap-3", top3.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {top3.map((r, i) => {
              const m = MEDAL_STYLES[i];
              const isFirst = i === 0;
              return (
                <div
                  key={r.ativador}
                  className={cn(
                    "relative overflow-hidden rounded-xl bg-gradient-to-br p-4 ring-1",
                    m.bg, m.ring,
                    isFirst && "sm:scale-[1.02]",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className={cn("h-7 w-7", m.text)} />
                      <div>
                        <p className={cn("font-subtitle text-[10px] uppercase tracking-wider", m.text)}>{m.label}</p>
                        <p className="font-numeric text-xs text-muted-foreground tabular-nums">{i + 1}º lugar</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-numeric font-bold tabular-nums", isTv ? "text-3xl" : "text-2xl", m.text)}>
                        {Math.round(r.scoreFinal)}

                      </p>
                      <p className="font-small text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
                    </div>
                  </div>
                  <p className={cn("mt-3 font-display font-semibold text-foreground truncate", isTv ? "text-xl" : "text-base")}>
                    {r.ativador}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctMrr.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">MRR</p>
                    </div>
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctClientes.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">Clientes</p>
                    </div>
                    <div>
                      <p className="font-numeric text-sm font-semibold tabular-nums text-foreground">{r.pctChurn.toFixed(0)}%</p>
                      <p className="font-small text-[10px] text-muted-foreground">Churn</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {rest.map((r, i) => (
                <div key={r.ativador} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-numeric text-sm font-bold tabular-nums text-muted-foreground w-6">
                      {i + 4}º
                    </span>
                    <span className="font-subtitle text-sm font-semibold text-foreground truncate">{r.ativador}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-numeric text-xs tabular-nums text-muted-foreground hidden sm:inline">
                      {fmtBRL(r.mrrAtivado)} · {r.clientesAtivados} cli
                    </span>
                    <span className="font-numeric text-sm font-bold tabular-nums text-foreground">
                      {Math.round(r.scoreFinal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
