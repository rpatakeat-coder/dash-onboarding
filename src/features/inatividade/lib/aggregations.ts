// Pure, full-universe aggregations for the dashboard KPIs and charts (S5/S6). No I/O. KPI cards and
// charts reflect the full universe (A-5); only the table responds to filters (see `table.ts`).

import type { BandCounts, Restaurant, RiskBandKey } from './types'
import { bandFromRow } from './risk'
import { brtMonthKey } from './format'

/** Tally rows into per-band counts (used when computing from raw rows rather than the upstream summary). */
export function bandCounts(data: Restaurant[]): BandCounts {
  const counts: BandCounts = { recem_criado: 0, nunca_movimentou: 0, ativo: 0, alerta: 0, critico: 0 }
  for (const r of data) counts[bandFromRow(r)] += 1
  return counts
}

/** The five KPI-card values (AC-013), computed from full-universe band counts. */
export interface Kpis {
  /** Total restaurants N. */
  total: number
  /** critico + alerta + nunca_movimentou. */
  totalEmRisco: number
  critico: number
  /** critico / N (0 when N=0). */
  criticoPct: number
  alerta: number
  /** alerta / N (0 when N=0). */
  alertaPct: number
  /** Excludes recem_criado. */
  nuncaMovimentou: number
  /** ≤7 days old, excluded from risk. */
  recemCriado: number
}

/** Compute the KPI values from band counts (AC-013). N is the sum of all bands (full universe). */
export function kpis(counts: BandCounts): Kpis {
  const total = counts.recem_criado + counts.nunca_movimentou + counts.ativo + counts.alerta + counts.critico
  const pct = (n: number): number => (total === 0 ? 0 : n / total)
  return {
    total,
    totalEmRisco: counts.critico + counts.alerta + counts.nunca_movimentou,
    critico: counts.critico,
    criticoPct: pct(counts.critico),
    alerta: counts.alerta,
    alertaPct: pct(counts.alerta),
    nuncaMovimentou: counts.nunca_movimentou,
    recemCriado: counts.recem_criado,
  }
}

/** One bucket of the inactivity-band chart (AC-015). `max=null` is the open-ended "+365". */
export interface InactivityBucket {
  label: string
  min: number
  max: number | null
  count: number
}

const BUCKET_DEFS: ReadonlyArray<{ label: string; min: number; max: number | null }> = [
  { label: '0–7', min: 0, max: 7 },
  { label: '8–30', min: 8, max: 30 },
  { label: '31–60', min: 31, max: 60 },
  { label: '61–90', min: 61, max: 90 },
  { label: '91–180', min: 91, max: 180 },
  { label: '181–365', min: 181, max: 365 },
  { label: '+365', min: 366, max: null },
]

/** Bucket `dias_inativo` (AC-015). Never-moved rows (`null`) are excluded. */
export function inactivityBuckets(data: Restaurant[]): InactivityBucket[] {
  const buckets: InactivityBucket[] = BUCKET_DEFS.map((b) => ({ ...b, count: 0 }))
  for (const r of data) {
    const d = r.dias_inativo
    if (d === null) continue // never-moved excluded (AC-015)
    const bucket = buckets.find((b) => d >= b.min && (b.max === null || d <= b.max))
    if (bucket) bucket.count += 1
  }
  return buckets
}

/** One month of the signups-vs-risk combo chart (AC-016). */
export interface SignupsMonth {
  /** `YYYY-MM`. */
  month: string
  /** Restaurants created that month. */
  signups: number
  /** Of that cohort, those whose band ∈ {critico, alerta, nunca_movimentou}. */
  emRisco: number
}

/** Bands counted as "at risk" in the signups chart. recem_criado is excluded by band, not by date (C1). */
const AT_RISK_BANDS: ReadonlySet<RiskBandKey> = new Set<RiskBandKey>(['critico', 'alerta', 'nunca_movimentou'])

/**
 * Trailing-`monthsBack` signups-vs-risk series ending at `referenceMonth` (`YYYY-MM`, inclusive),
 * ascending (AC-016). A ≤7-day-old no-order restaurant is `recem_criado` (first-match-wins), so it
 * never lands in the at-risk series — no separate date clause is needed (C1).
 */
export function signupsVsRisk(data: Restaurant[], referenceMonth: string, monthsBack = 18): SignupsMonth[] {
  const signups = new Map<string, number>()
  const risk = new Map<string, number>()
  for (const r of data) {
    const month = brtMonthKey(r.criado_em)
    if (!month) continue
    signups.set(month, (signups.get(month) ?? 0) + 1)
    if (AT_RISK_BANDS.has(bandFromRow(r))) risk.set(month, (risk.get(month) ?? 0) + 1)
  }
  return monthWindow(referenceMonth, monthsBack).map((month) => ({
    month,
    signups: signups.get(month) ?? 0,
    emRisco: risk.get(month) ?? 0,
  }))
}

/** The `n` month keys ending at `ref` (inclusive), ascending. */
function monthWindow(ref: string, n: number): string[] {
  const [y, m] = ref.split('-').map(Number)
  let year = y
  let month = m // 1-12
  const out: string[] = []
  for (let i = 0; i < n; i += 1) {
    out.unshift(`${year}-${String(month).padStart(2, '0')}`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return out
}
