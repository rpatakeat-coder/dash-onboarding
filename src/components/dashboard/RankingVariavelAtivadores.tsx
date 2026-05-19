import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseDate,
  parseActivationDate,
  CHURN_STAGE_IDS,
  CHURN_CANCELAMENTO_PIPELINE,
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
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
  for (const t of SCORE_TABLE) if (score >= t.score) return t.pctFixo;
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

export const RankingVariavelAtivadores = ({ rows, onlyAgente }: Props) => {
  const data = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = start;

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
      const etapa = (r.etapa_negocio ?? "").trim();
      const cancel = (r.etapa_de_cancelamento ?? "").trim().toLowerCase();
      const isChurn =
        CHURN_STAGE_IDS.has(etapa) ||
        cancel === CHURN_CANCELAMENTO_PIPELINE.toLowerCase();
      if (isChurn && inMonth(parseDate(r.data_fechamento))) {
        const c = ensure(agente);
        c.churnReal += mrr;
      }
    }

    const result: Row[] = [];
    map.forEach((c) => {
      c.pctMrr = c.mrrCriadoAnterior > 0 ? (c.mrrAtivado / c.mrrCriadoAnterior) * 100 : 0;
      c.pctClientes = c.clientesCriadosAnterior > 0 ? (c.clientesAtivados / c.clientesCriadosAnterior) * 100 : 0;
      c.churnMax = c.mrrCriado * 0.09;
      c.pctChurn = c.churnMax > 0 ? ((c.churnMax - c.churnReal) / c.churnMax) * 100 : 0;
      // Score ponderado: MRR 60 + Clientes 30 + Churn 10 (média ponderada / 100)
      c.scoreFinal = (c.pctMrr * 60 + c.pctClientes * 30 + c.pctChurn * 10) / 100;
      c.pctFixo = pctFixoFromScore(c.scoreFinal);
      result.push(c);
    });

    result.sort((a, b) => b.scoreFinal - a.scoreFinal);
    return onlyAgente
      ? result.filter((r) => r.ativador.toLowerCase() === onlyAgente.toLowerCase())
      : result;
  }, [rows, onlyAgente]);

  if (!data.length) return null;

  const scoreColor = (s: number) =>
    s >= 90 ? "text-success" : s >= 70 ? "text-foreground" : s >= 50 ? "text-warning" : "text-destructive";
  const pctFixoColor = (p: number) =>
    p >= 100 ? "text-success" : p >= 60 ? "text-foreground" : p >= 30 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm-soft sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-secondary">
            Ranking de variável por ativador
          </h2>
          <p className="font-small text-xs text-muted-foreground">
            Mês vigente · MRR (peso 60) + Clientes (peso 30) + Churn (peso 10)
          </p>
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
              <th className="px-3 py-2 text-right">% Churn</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">% do fixo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((r, i) => (
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
                  {r.clientesAtivados} / {r.clientesCriados}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-semibold tabular-nums", scoreColor(r.pctClientes))}>
                  {fmtPct(r.pctClientes)}
                </td>
                <td className="px-3 py-2 text-right font-numeric tabular-nums text-muted-foreground">
                  {fmtBRL(r.churnReal)} / {fmtBRL(r.churnMax)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-semibold tabular-nums", scoreColor(r.pctChurn))}>
                  {fmtPct(r.pctChurn)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-bold tabular-nums", scoreColor(r.scoreFinal))}>
                  {r.scoreFinal.toFixed(1)}
                </td>
                <td className={cn("px-3 py-2 text-right font-numeric font-bold tabular-nums", pctFixoColor(r.pctFixo))}>
                  {r.pctFixo}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Faixas: 50→20% · 55→30% · 60→40% · 65→50% · 70→60% · 80→70% · 90→100% · 130→120%
      </p>
    </div>
  );
};
