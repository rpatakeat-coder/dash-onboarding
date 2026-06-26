// GET /api/cron/refresh — nightly cache warmer (Vercel Cron, 03:00 BRT / 06:00 UTC).
//
// This is NOT the app-password gate: a cron can't present the session cookie, so it authenticates with
// `CRON_SECRET`, which Vercel sends automatically as `Authorization: Bearer <CRON_SECRET>` on scheduled
// invocations (and which we require here so the path can't be triggered by anyone else). It forces a
// full rebuild — page `inactive-risk`, enrich from HubSpot — and writes it to the durable KV cache, so
// the one heavy upstream scan happens once, off-peak. Daytime `/api/restaurants` calls are then pure
// cache reads that never touch the Takeat backend.

import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { getDefaultStore } from '../_lib/cache.js'
import { buildRiskDataset } from '../_lib/inactiveRisk.js'
import { resolveDataset, enrichWithOwners } from '../restaurants.js'

function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  return typeof value === 'string' ? value : ''
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const secret = process.env.CRON_SECRET
  if (!secret || bearer(req.headers.authorization) !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const result = await resolveDataset({
    store: getDefaultStore(),
    now: Date.now(),
    forceRefresh: true, // always rebuild + repopulate the cache, regardless of current freshness
    build: buildRiskDataset,
    enrich: enrichWithOwners,
  })

  const body = (result.body ?? {}) as { data?: unknown[]; warnings?: string[]; stale?: boolean }
  res.status(result.status).json({
    ok: result.status === 200,
    rows: Array.isArray(body.data) ? body.data.length : 0,
    stale: body.stale ?? null,
    warnings: body.warnings ?? [],
  })
}
