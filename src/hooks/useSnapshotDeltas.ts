import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeltaWindow = 7 | 30;

export interface KpiDelta {
  /** Diferença absoluta (atual - anterior). null se não houver dados anteriores. */
  abs: number | null;
  /** Variação percentual relativa. null se não houver base. */
  pct: number | null;
  /** Quantidade de dias usados na janela atual (pode ser menor que `window`). */
  currentDays: number;
  /** Quantidade de dias usados na janela anterior. */
  previousDays: number;
}

export interface SnapshotDeltas {
  total: KpiDelta;
  slaMedio: KpiDelta;
  noPrazo: KpiDelta;
  estourado: KpiDelta;
  windowDays: DeltaWindow;
}

interface SnapshotRow {
  snapshot_date: string;
  total: number;
  sla_medio: number;
  pct_no_prazo: number;
}

const EMPTY: KpiDelta = { abs: null, pct: null, currentDays: 0, previousDays: 0 };

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function computeDelta(current: number[], previous: number[]): KpiDelta {
  const cur = avg(current);
  const prev = avg(previous);
  if (cur === null || prev === null) {
    return { abs: null, pct: null, currentDays: current.length, previousDays: previous.length };
  }
  const abs = cur - prev;
  const pct = prev !== 0 ? (abs / prev) * 100 : null;
  return { abs, pct, currentDays: current.length, previousDays: previous.length };
}

export function useSnapshotDeltas(windowDays: DeltaWindow) {
  return useQuery({
    queryKey: ["snapshot_deltas", windowDays],
    queryFn: async (): Promise<SnapshotDeltas> => {
      const since = new Date();
      since.setDate(since.getDate() - windowDays * 2);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("dash_operacoes_snapshots")
        .select("snapshot_date,total,sla_medio,pct_no_prazo")
        .gte("snapshot_date", sinceStr)
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as SnapshotRow[];

      const today = new Date();
      const cutCurrent = new Date(today);
      cutCurrent.setDate(cutCurrent.getDate() - windowDays);
      const cutPrev = new Date(today);
      cutPrev.setDate(cutPrev.getDate() - windowDays * 2);

      const cur = rows.filter((r) => new Date(r.snapshot_date) > cutCurrent);
      const prev = rows.filter(
        (r) => new Date(r.snapshot_date) > cutPrev && new Date(r.snapshot_date) <= cutCurrent,
      );

      const pick = (xs: SnapshotRow[], k: keyof SnapshotRow) =>
        xs.map((r) => Number(r[k])).filter((n) => Number.isFinite(n));

      return {
        total: computeDelta(pick(cur, "total"), pick(prev, "total")),
        slaMedio: computeDelta(pick(cur, "sla_medio"), pick(prev, "sla_medio")),
        noPrazo: computeDelta(pick(cur, "pct_no_prazo"), pick(prev, "pct_no_prazo")),
        estourado: computeDelta(
          pick(cur, "pct_no_prazo").map((v) => 100 - v),
          pick(prev, "pct_no_prazo").map((v) => 100 - v),
        ),
        windowDays,
      };
    },
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export const noDelta = (): KpiDelta => EMPTY;
