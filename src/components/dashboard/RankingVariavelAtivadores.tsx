import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";
import { useRankingExcluidos } from "@/hooks/useRankingExcluidos";
import { normAgente } from "@/lib/rankingExclusao";
import {
  parseDate,
  parseActivationDate,
  isChurnRow,
  type DashRow,
} from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  onlyAgente?: string | null;
}

const toNum = (v: string | null | undefined) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtPct = (v: number) => `${v.toFixed(0)}%`;
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tabela score → % do fixo (lower bound)
const SCORE_TABLE: { score: number; pctFixo: number }[] = [
  { score: 130, pctFixo: 120 },
  { score: 90, pctFixo: 100 },
  { score: 80, pctFixo: 70 },
  { score: 70, pctFixo: 60 },
  { score: 65, pctFixo: 50 },
  { score: 60, pctFixo: 40 },
  { score: 55, pctFixo: 30 },
  { score: 50, pctFixo: 20 },
];

const pctFixoFromScore = (score: number): number => {
  const rounded = Math.round(score); // >= .5 arredonda pra cima
  for (const t of SCORE_TABLE) if (rounded >= t.score) return t.pctFixo;
  return 0;
};

interface Row {
  ativador: string;
  mrrCriado: number;            // mês vigente (base do churn máx)
  mrrCriadoAnterior: number;    // mês anterior (denominador do % MRR)
  mrrAtivado: number;
  pctMrr: number;
  clientesCriados: number;            // mês vigente
  clientesCriadosAnterior: number;    // mês anterior (denominador do % Clientes)
  clientesAtivados: number;
  pctClientes: number;
  churnMax: number;
  churnReal: number;
  pctChurn: number;
  scoreFinal: number;
  pctFixo: number;
}

type PeriodKey = "semana" | "mes" | "trimestre";
const PERIOD_LABELS: Record<PeriodKey, string> = { semana: "Semana", mes: "Mês", trimestre: "Trimestre" };

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: start };
};

export const RankingVariavelAtivadores = ({ rows, onlyAgente }: Props) => {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const { excluidos } = useRankingExcluidos();
  const data = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getRanges(period);
    const excl = new Set(excluidos.map(normAgente));

    const inMonth = (d: Date | null) => !!d && d >= start && d < end;
    const inPrevMonth = (d: Date | null) => !!d && d >= prevStart && d < prevEnd;

    const map = new Map<string, Row>();
    const ensure = (nome: string): Row => {
      const k = nome.trim() || "Sem responsável";
      let cur = map.get(k);
      if (!cur) {
        cur = {
          ativador: k,
          mrrCriado: 0, mrrCriadoAnterior: 0, mrrAtivado: 0, pctMrr: 0,
          clientesCriados: 0, clientesCriadosAnterior: 0, clientesAtivados: 0, pctClientes: 0,
          churnMax: 0, churnReal: 0, pctChurn: 0,
          scoreFinal: 0, pctFixo: 0,
        };
        map.set(k, cur);
      }
      return cur;
    };

    for (const r of rows) {
      const agente = r.agente_ativacao?.trim();
      if (!agente) continue;
      const mrr = toNum(r.mrr);
      const dCriacao = parseDate(r.data_criacao);

      if (inMonth(dCriacao)) {
        const c = ensure(agente);
        c.mrrCriado += mrr;
        c.clientesCriados += 1;
      }
      if (inPrevMonth(dCriacao)) {
        const c = ensure(agente);
        c.mrrCriadoAnterior += mrr;
        c.clientesCriadosAnterior += 1;
      }
      if (inMonth(parseActivationDate(r.data_ativacao))) {
        const c = ensure(agente);
        c.mrrAtivado += mrr;
        c.clientesAtivados += 1;
      }
      if (isChurnRow(r) && inMonth(parseDate(r.data_fechamento))) {
        const c = ensure(agente);
        c.churnReal += mrr;
      }
    }

    const result: Row[] = [];
    map.forEach((c) => {
      c.pctMrr = c.mrrCriadoAnterior > 0 ? (c.mrrAtivado / c.mrrCriadoAnterior) * 100 : 0;
      c.pctClientes = c.clientesCriadosAnterior > 0 ? (c.clientesAtivados / c.clientesCriadosAnterior) * 100 : 0;
      // Churn máx = 9% do MRR criado pelo ativador no mês anterior
      c.churnMax = c.mrrCriadoAnterior * 0.09;
      // % Churn exibido = quanto do teto foi consumido (real / máx × 100). Quanto menor, melhor.
      c.pctChurn = c.churnMax > 0 ? (c.churnReal / c.churnMax) * 100 : 0;
      // Score (fórmula da planilha "Variável"):
      //   = 60×%MRR + 30×%Clientes + SE(margemChurn<0; margemChurn×10; 0)
      // margemChurn (decimal) = (churnMáx − churnReal) / churnMáx.
      // Positivo = dentro do teto (sem bônus); negativo = estourou (penaliza).
      const churnMargem = c.churnMax > 0 ? (c.churnMax - c.churnReal) / c.churnMax : 0;
      const churnTerm = churnMargem < 0 ? churnMargem * 10 : 0;
      c.scoreFinal = Math.max(0, (c.pctMrr * 60 + c.pctClientes * 30) / 100 + churnTerm);
      c.pctFixo = pctFixoFromScore(c.scoreFinal);
      if (!excl.has(normAgente(c.ativador))) result.push(c); // admin pode remover do ranking
    });

    result.sort((a, b) => b.scoreFinal - a.scoreFinal);
    const filtered = onlyAgente
      ? result.filter((r) => r.ativador.toLowerCase() === onlyAgente.toLowerCase())
      : result;

    // Consolidado do time (soma de todos os ativadores, sem filtro)
    const totals = result.reduce(
      (acc, r) => {
        acc.mrrCriadoAnterior += r.mrrCriadoAnterior;
        acc.mrrAtivado += r.mrrAtivado;
        acc.clientesCriadosAnterior += r.clientesCriadosAnterior;
        acc.clientesAtivados += r.clientesAtivados;
        acc.churnReal += r.churnReal;
        return acc;
      },
      { mrrCriadoAnterior: 0, mrrAtivado: 0, clientesCriadosAnterior: 0, clientesAtivados: 0, churnReal: 0 },
    );
    const tPctMrr = totals.mrrCriadoAnterior > 0 ? (totals.mrrAtivado / totals.mrrCriadoAnterior) * 100 : 0;
    const tPctClientes = totals.clientesCriadosAnterior > 0 ? (totals.clientesAtivados / totals.clientesCriadosAnterior) * 100 : 0;
    const tChurnMax = totals.mrrCriadoAnterior * 0.09;
    const tPctChurn = tChurnMax > 0 ? (totals.churnReal / tChurnMax) * 100 : 0;
    const tChurnMargem = tChurnMax > 0 ? (tChurnMax - totals.churnReal) / tChurnMax : 0;
    const tChurnTerm = tChurnMargem < 0 ? tChurnMargem * 10 : 0;
    const tScore = Math.max(0, (tPctMrr * 60 + tPctClientes * 30) / 100 + tChurnTerm);
    const team = {
      mrrAtivado: totals.mrrAtivado,
      mrrCriadoAnterior: totals.mrrCriadoAnterior,
      clientesAtivados: totals.clientesAtivados,
      clientesCriadosAnterior: totals.clientesCriadosAnterior,
      churnReal: totals.churnReal,
      churnMax: tChurnMax,
      pctMrr: tPctMrr,
      pctClientes: tPctClientes,
      pctChurn: tPctChurn,
      scoreFinal: tScore,
      pctFixo: pctFixoFromScore(tScore),
    };

    return { rows: filtered, team };
  }, [rows, onlyAgente, period, excluidos]);

  if (!data.rows.length) return null;
  const { rows: tableRows, team } = data;

  const scoreColor = (s: number) =>
    s >= 90 ? "text-success" : s >= 70 ? "text-foreground" : s >= 50 ? "text-warning" : "text-destructive";
  // Para % Churn, quanto MENOR melhor: 0–60% ótimo, 60–100% atenção, >100% estourou.
  const pctChurnColor = (p: number) =>
    p > 100 ? "text-destructive" : p >= 60 ? "text-warning" : "text-success";
  const pctFixoColor = (p: number) =>
    p >= 100 ? "text-success" : p >= 60 ? "text-foreground" : p >= 30 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-secondary">
              Ranking de variável por ativador
            </h2>
            <p className="font-small text-xs text-muted-foreground">
              {PERIOD_LABELS[period]} vigente · MRR (peso 60) + Clientes (peso 30) + Churn (peso 10)
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
                period === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50">
            <tr className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Ativador</th>
              <th className="px-3 py-2 text-right">MRR ativado / criado</th>
              <th className="px-3 py-2 text-right">% MRR</th>
              <th className="px-3 py-2 text-right">Clientes ativ./criados</th>
              <th className="px-3 py-2 text-right">% Clientes</th>
              <th className="px-3 py-2 text-right">Churn (real / máx)</th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  % Churn
                  <InfoTooltip text="Churn máx = 9% do MRR criado pelo próprio ativador no MÊS ANTERIOR. % Churn = (Churn real ÷ Churn máx) × 100 — mostra quanto do teto foi consumido. Quanto MENOR, melhor: 0% = nenhum churn, 100% = bateu no teto, >100% = estourou (vira penalidade no score)." />
                </span>
              </th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  Score
                  <InfoTooltip text="Score = 60×%MRR + 30×%Clientes + SE(margemChurn<0; margemChurn×10; 0). margemChurn = (Churn máx − Churn real) / Churn máx. Dentro do teto (margem ≥ 0): churn não soma nem subtrai. Estourou (margem < 0): cada 1% de estouro tira 0,1 ponto. Piso 0. Arredondamento ≥ .5 sobe antes de consultar a tabela de % do fixo." />

                </span>
              </th>
              <th className="px-3 py-2 text-right">% do fixo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableRows.map((r, i) => (
              <tr key={r.ativador} className="transition-colors hover:bg-muted/40">
                <td className="px-3 py-2 font-numeric font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-2 font-semibold text-foreground">{r.ativador}</td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                  {fmtBRL(r.mrrAtivado)} / {fmtBRL(r.mrrCriadoAnterior)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-semibold tabular-nums", scoreColor(r.pctMrr))}>
                  {fmtPct(r.pctMrr)}
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                  {r.clientesAtivados} / {r.clientesCriadosAnterior}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-semibold tabular-nums", scoreColor(r.pctClientes))}>
                  {fmtPct(r.pctClientes)}
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                  {fmtBRL(r.churnReal)} / {fmtBRL(r.churnMax)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-semibold tabular-nums", pctChurnColor(r.pctChurn))}>
                  {fmtPct(r.pctChurn)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-bold tabular-nums", scoreColor(r.scoreFinal))}>
                  {Math.round(r.scoreFinal)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-bold tabular-nums", pctFixoColor(r.pctFixo))}>
                  {r.pctFixo}%
                </td>
              </tr>
            ))}
          </tbody>
          {!onlyAgente && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2.5 text-muted-foreground" />
                <td className="px-3 py-2.5 font-display text-foreground">Time (consolidado)</td>
                <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">
                  {fmtBRL(team.mrrAtivado)} / {fmtBRL(team.mrrCriadoAnterior)}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-numeric font-bold tabular-nums", scoreColor(team.pctMrr))}>
                  {fmtPct(team.pctMrr)}
                </td>
                <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">
                  {team.clientesAtivados} / {team.clientesCriadosAnterior}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-numeric font-bold tabular-nums", scoreColor(team.pctClientes))}>
                  {fmtPct(team.pctClientes)}
                </td>
                <td className="px-3 py-2.5 text-right font-numeric tabular-nums text-muted-foreground">
                  {fmtBRL(team.churnReal)} / {fmtBRL(team.churnMax)}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-numeric font-bold tabular-nums", pctChurnColor(team.pctChurn))}>
                  {fmtPct(team.pctChurn)}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-numeric font-bold tabular-nums", scoreColor(team.scoreFinal))}>
                  {Math.round(team.scoreFinal)}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-numeric font-bold tabular-nums", pctFixoColor(team.pctFixo))}>
                  {team.pctFixo}%
                </td>
              </tr>
            </tfoot>
          )}

        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Faixas: 50→20% · 55→30% · 60→40% · 65→50% · 70→60% · 80→70% · 90→100% · 130→120%
      </p>
    </div>
  );
};
