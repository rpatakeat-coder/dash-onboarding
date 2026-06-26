// GET /api/restaurants — the dataset the SPA consumes. Gated by the app-password session (AC-003).
// Serves the durable daily cache when fresh (zero upstream calls — AC-007), rebuilds it otherwise,
// and degrades to the last-good stale copy if the rebuild fails (AC-009A). `?refresh=1` forces a
// rebuild (the manual refresh control, wired in S7).

import type { ApiRequest, ApiResponse } from './_lib/http.js'
import type { Dataset, Restaurant } from './_lib/types.js'
import { requireSupabaseUser } from './_lib/supabaseAuth.js'
import {
  getDefaultStore,
  isFresh,
  readCachedDataset,
  writeCachedDataset,
  type KvStore,
} from './_lib/cache.js'
import { buildRiskDataset, type RiskBuildResult } from './_lib/inactiveRisk.js'
import { enrichWithChurn } from './_lib/churn.js'
import { fetchHubspotOwners } from './_lib/hubspot.js'
import { matchOwners } from './_lib/matcher.js'
import aliases from '../data/cs-aliases.json' with { type: 'json' }

const STALE_WARNING = 'Os dados podem estar desatualizados: falha ao atualizar a partir da fonte.'
const HUBSPOT_WARNING = 'Responsáveis CS indisponíveis: não foi possível consultar o HubSpot.'
const PARTIAL_WARNING = 'Dados parciais: o processamento atingiu o limite de tempo. Considere o plano Vercel Pro para o universo completo.'
/** Deadline (ms) que o build inteiro (inactive-risk + HubSpot) deve respeitar, deixando folga para
 *  o churn-enrich, a gravação no KV e a resposta dentro do limite de duração da função (Hobby = 60s). */
const BUILD_BUDGET_MS = 50_000

/** The owner-enrichment overlay applied to a fresh build before caching/serving. */
export interface EnrichResult {
  data: Restaurant[]
  owners: string[]
  warnings: string[]
}

/**
 * Layer HubSpot CS owners onto a fresh build (S4). Non-fatal by contract: any HubSpot failure leaves
 * every `responsavel_cs` null plus a warning, with the risk data fully intact (AC-009B). The HubSpot
 * outage must never fail the request, so this never rethrows.
 */
export async function enrichWithOwners(built: RiskBuildResult, deadlineMs?: number): Promise<EnrichResult> {
  try {
    const owners = await fetchHubspotOwners(deadlineMs)
    const outcome = matchOwners({
      restaurants: built.data,
      companies: owners,
      aliases: aliases as Record<string, string>,
    })
    const warnings = outcome.semResponsavel > 0 ? [`${outcome.semResponsavel} sem responsável CS`] : []
    return { data: outcome.data, owners: outcome.owners, warnings }
  } catch {
    return {
      data: built.data.map((r) => ({ ...r, responsavel_cs: null })),
      owners: [],
      warnings: [HUBSPOT_WARNING],
    }
  }
}

/** Default no-op overlay (S3 behavior) used when no enrichment is injected. */
async function passthroughEnrich(built: RiskBuildResult): Promise<EnrichResult> {
  return { data: built.data, owners: [], warnings: [] }
}

export interface ResolveResult {
  status: number
  body: unknown
}

/** Pure orchestration (deps injected) so cache/build/degradation paths are unit-testable. */
export async function resolveDataset(deps: {
  store: KvStore
  now: number
  forceRefresh: boolean
  build: () => Promise<RiskBuildResult>
  /** Owner overlay applied to a fresh build (defaults to a no-op; the handler injects HubSpot). */
  enrich?: (built: RiskBuildResult) => Promise<EnrichResult>
}): Promise<ResolveResult> {
  const { store, now, forceRefresh, build, enrich = passthroughEnrich } = deps

  let cached = null
  try {
    cached = await readCachedDataset(store)
  } catch {
    cached = null // a cache read failure must not break the request
  }

  // Requisição de usuário (não-cron) NUNCA puxa do upstream: serve o que houver no cache
  // (fresco OU vencido). O upstream só é puxado pelo cron das 3h (forceRefresh). Exceção:
  // bootstrap — quando ainda não existe NENHUM cache, faz UMA carga (senão a página ficaria
  // vazia até o primeiro cron). Depois disso, abrir a página nunca mais bate na API.
  if (cached && !forceRefresh) {
    const stale = !isFresh(cached.storedAt, now)
    return {
      status: 200,
      body: stale
        ? { ...cached.dataset, stale: true, warnings: [...cached.dataset.warnings, STALE_WARNING] }
        : cached.dataset,
    }
  }

  try {
    const built = await build()
    const enriched = await enrich(built)
    // Predictive churn scores join last (deterministic, never fails — unscored rows get null).
    const churn = enrichWithChurn(enriched.data)
    const dataset: Dataset = {
      generated_at: built.generated_at,
      summary: built.summary,
      owners: enriched.owners,
      data: churn.data,
      stale: false,
      warnings: built.partial ? [...enriched.warnings, PARTIAL_WARNING] : enriched.warnings,
      scores_generated_at: churn.scores_generated_at,
    }
    try {
      await writeCachedDataset(store, dataset, now)
    } catch {
      // a cache write failure is non-fatal — still serve the fresh dataset
    }
    return { status: 200, body: dataset }
  } catch {
    // Rebuild failed (endpoint down or service auth broken). Degrade to the last good copy if any.
    if (cached) {
      return {
        status: 200,
        body: { ...cached.dataset, stale: true, warnings: [...cached.dataset.warnings, STALE_WARNING] },
      }
    }
    return { status: 502, body: { error: 'dataset_unavailable' } }
  }
}

function wantsRefresh(req: ApiRequest): boolean {
  const v = req.query?.refresh
  const value = Array.isArray(v) ? v[0] : v
  return value === '1' || value === 'true'
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await requireSupabaseUser(req))) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const deadline = Date.now() + BUILD_BUDGET_MS
  const result = await resolveDataset({
    store: getDefaultStore(),
    now: Date.now(),
    forceRefresh: wantsRefresh(req),
    build: () => buildRiskDataset(deadline),
    enrich: (built) => enrichWithOwners(built, deadline),
  })
  res.status(result.status).json(result.body)
}
