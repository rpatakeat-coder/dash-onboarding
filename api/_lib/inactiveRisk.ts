// Pages the entire `inactive-risk` universe and shapes it into the risk-only dataset (HubSpot owners
// are layered on in S4). Auth model A: the service JWT (from serviceLogin) authorizes the calls; an
// upstream 401 mid-fetch is recovered once by re-logging-in with the service account (AC-008).

import type { BandCounts, RawRiskRow, Restaurant, RiskBandKey } from './types.js'
import { RISK_BAND_KEYS } from './risk.js'
import { parseDiasInativo } from './format.js'
import { serviceLogin, upstreamFetch } from './upstream.js'

const PAGE_SIZE = 200
/** Absolute safety cap on pages, far above the real universe (~2,800 rows / 200 ≈ 14 pages). */
const MAX_PAGES = 1000

/** Thrown when the service token is still rejected after a re-login — a config/auth fault. */
export class UpstreamAuthError extends Error {}
/** Thrown for any other non-OK or malformed upstream response. */
export class UpstreamError extends Error {}

interface InactiveRiskResponse {
  meta: { total: number; page: number; page_size: number; generated_at: string }
  summary: Record<string, number>
  data: RawRiskRow[]
}

/** The risk-only build result. `restaurants.ts` shapes this into a `Dataset` (owners/warnings added later). */
export interface RiskBuildResult {
  generated_at: string
  summary: BandCounts
  data: Restaurant[]
}

function coerceSummary(raw: Record<string, number> | undefined): BandCounts {
  const out = {} as BandCounts
  for (const key of RISK_BAND_KEYS) out[key as RiskBandKey] = Number(raw?.[key] ?? 0) || 0
  return out
}

/**
 * Fetch the full universe by paging with the service JWT. Dedupes by `restaurant_id` while collecting:
 * the upstream orders by `dias_inativo DESC NULLS FIRST` without a stable tiebreaker, so the same row
 * can resurface across pages (especially among the many never-moved rows). We therefore drive the loop
 * by the count of *distinct* ids reaching `meta.total` (C3), and stop early if a whole page contributes
 * no new id — both a runaway-loop guard and what keeps each restaurant appearing exactly once (a churn
 * report must not double-count, and duplicate ids would also collide as React keys in the table).
 */
export async function buildRiskDataset(): Promise<RiskBuildResult> {
  let token = await serviceLogin()
  let reloggedIn = false

  async function fetchPage(page: number): Promise<InactiveRiskResponse> {
    const path = `/api/v1/restaurants/inactive-risk?page=${page}&page_size=${PAGE_SIZE}`
    let res = await upstreamFetch(path, { headers: { Authorization: `Bearer ${token}` } })
    // Recover a stale/expired service token exactly once, then retry the same page.
    if (res.status === 401 && !reloggedIn) {
      reloggedIn = true
      token = await serviceLogin()
      res = await upstreamFetch(path, { headers: { Authorization: `Bearer ${token}` } })
    }
    if (res.status === 401) throw new UpstreamAuthError('inactive-risk rejected the service token after re-login')
    if (!res.ok) throw new UpstreamError(`inactive-risk page ${page} failed: ${res.status}`)
    const body = (await res.json().catch(() => null)) as InactiveRiskResponse | null
    if (!body || !body.meta || !Array.isArray(body.data)) {
      throw new UpstreamError(`malformed inactive-risk response on page ${page}`)
    }
    return body
  }

  // Dedupe by restaurant_id, first occurrence wins (preserves the upstream's intended ordering).
  const seen = new Map<number, RawRiskRow>()
  const addRows = (rows: RawRiskRow[]): void => {
    for (const r of rows) if (!seen.has(r.restaurant_id)) seen.set(r.restaurant_id, r)
  }

  const first = await fetchPage(1)
  const total = Number(first.meta.total) || 0
  addRows(first.data)

  // Paginação PARALELA (concorrência limitada). O upstream ordena sem tiebreaker estável e pode
  // repetir linhas entre páginas, mas o dedupe por restaurant_id resolve. Buscar as páginas
  // concorrentemente (em vez de uma a uma) é o que faz o build caber no limite de tempo da função.
  const pageSize = first.data.length || PAGE_SIZE
  const numPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / pageSize)))
  const CONCURRENCY = 8
  for (let start = 2; start <= numPages; start += CONCURRENCY) {
    const batch: number[] = []
    for (let p = start; p < start + CONCURRENCY && p <= numPages; p += 1) batch.push(p)
    const pages = await Promise.all(batch.map((p) => fetchPage(p)))
    for (const pg of pages) addRows(pg.data)
  }

  const data: Restaurant[] = [...seen.values()].map((row) => ({
    ...row,
    dias_inativo: parseDiasInativo(row.dias_inativo),
    responsavel_cs: null,
  }))

  return {
    generated_at: first.meta.generated_at,
    summary: coerceSummary(first.summary),
    data,
  }
}
