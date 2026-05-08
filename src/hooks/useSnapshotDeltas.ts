import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeltaWindow = 7 | 30;

export interface DateRange {
  /** ISO date (YYYY-MM-DD) — início (inclusivo). */
  start: string;
  /** ISO date (YYYY-MM-DD) — fim (inclusivo). */
  end: string;
}

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
  /** Janela atual planejada (independe da existência de dados). */
  currentRange: DateRange;
  /** Janela anterior planejada. */
  previousRange: DateRange;
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

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function useSnapshotDeltas(windowDays: DeltaWindow) {
  return useQuery({
    queryKey: ["snapshot_deltas", windowDays],
    queryFn: async (): Promise<SnapshotDeltas> => {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const currentEnd = startOfToday;
      const currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() - (windowDays - 1));

      const previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - (windowDays - 1));

      const sinceStr = isoDay(previousStart);

      const { data, error } = await supabase
        .from("dash_operacoes_snapshots")
        .select("snapshot_date,total,sla_medio,pct_no_prazo")
        .gte("snapshot_date", sinceStr)
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as SnapshotRow[];

      const inRange = (r: SnapshotRow, start: Date, end: Date) => {
        const d = new Date(r.snapshot_date);
        return d >= start && d <= end;
      };
      const cur = rows.filter((r) => inRange(r, currentStart, currentEnd));
      const prev = rows.filter((r) => inRange(r, previousStart, previousEnd));

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
        currentRange: { start: isoDay(currentStart), end: isoDay(currentEnd) },
        previousRange: { start: isoDay(previousStart), end: isoDay(previousEnd) },
      };
    },
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export const noDelta = (): KpiDelta => EMPTY;
