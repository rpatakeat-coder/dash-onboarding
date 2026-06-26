// Read-only HubSpot client (S4). Resolves each restaurant's "Responsável CS" from the HubSpot **Deal**
// object ("Negócios") — not the company. Two custom deal properties drive everything:
//   - the join key  (`HUBSPOT_DEAL_USERNAME_PROPERTY`, default `username`): the Takeat slug
//     ("Username do cliente (Dash Takeat)"), matched against the report's `restaurante`.
//   - the CS agent  (`HUBSPOT_CS_OWNER_PROPERTY`, default `agente_do_sucesso_responsavel`): an
//     owner-reference enumeration whose stored value is a HubSpot **owner id**. We resolve ids to the
//     owner's display name via `/crm/v3/owners`; any non-id text is used as-is (defensive).
//
// The Private App token has read scope for deals + owners and lives only in env — never sent to the
// browser. We use the CRM **search** endpoint with a `HAS_PROPERTY` filter on the username so we only
// page deals that carry a Takeat slug (~4.7k of ~83k total) instead of the whole deal universe — an
// ~18× reduction in round-trips, which keeps the build inside the serverless time budget. A restaurant
// can have many deals, so we dedup by normalized username, keeping the owner from the
// **most-recently-modified deal that actually names an agent** (an old deal's agent is preferred over a
// newer deal that left the field blank). Search caps at 10k results; the username set is well under it.
// Requests retry on 429/5xx (HubSpot's search limit is ~4 req/s) and pages are lightly throttled.

import { normalizeName } from './format.js'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const PAGE_LIMIT = 100
/** Safety cap on pagination — far above any real deal/owner count. */
const MAX_PAGES = 2000
/** Retry budget + base backoff for transient 429/5xx responses. */
const MAX_RETRIES = 5
const BASE_RETRY_MS = 500
/** Inter-page delay to stay under HubSpot's ~4 req/s search secondary limit. */
const PAGE_THROTTLE_MS = 150
const DEFAULT_CS_PROPERTY = 'agente_do_sucesso_responsavel'
const DEFAULT_USERNAME_PROPERTY = 'username'
const LAST_MODIFIED_PROPERTY = 'hs_lastmodifieddate'

/** Thrown when HubSpot is unconfigured, unreachable, or returns a malformed/non-OK response. */
export class HubspotError extends Error {}

/** One restaurant's resolved CS owner, keyed by its normalized Takeat username for the join. */
export interface OwnerRecord {
  /** The deal id that supplied this record's owner (or its first-seen deal when ownerless). */
  id: string
  /** The raw username as stored on the deal (for display/debugging). */
  name: string
  /** `normalizeName(username)` — the join key against `normalizeName(restaurante)`. */
  normalizedName: string
  /** Resolved CS owner display value, or `null` when no deal for this username names an agent. */
  owner: string | null
}

interface HubspotPage {
  results: Array<{ id?: string | number; properties?: Record<string, unknown> }>
  paging?: { next?: { after?: string } }
}

interface HubspotOwnersPage {
  results: Array<{ id?: string | number; firstName?: string; lastName?: string; email?: string }>
  paging?: { next?: { after?: string } }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function getConfig(): { token: string; usernameProperty: string; csProperty: string } {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!token) throw new HubspotError('HUBSPOT_PRIVATE_APP_TOKEN is not configured')
  return {
    token,
    usernameProperty: process.env.HUBSPOT_DEAL_USERNAME_PROPERTY || DEFAULT_USERNAME_PROPERTY,
    csProperty: process.env.HUBSPOT_CS_OWNER_PROPERTY || DEFAULT_CS_PROPERTY,
  }
}

/** Fetch + validate a HubSpot JSON page, retrying transient 429/5xx with backoff (honors Retry-After). */
async function hubspotRequest<T>(path: string, token: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init.body) headers['content-type'] = 'application/json'

  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, { ...init, headers })

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers?.get?.('retry-after'))
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BASE_RETRY_MS * 2 ** attempt
    await sleep(delay)
    return hubspotRequest<T>(path, token, init, attempt + 1)
  }

  if (!res.ok) throw new HubspotError(`HubSpot ${path} failed: ${res.status}`)
  const body = (await res.json().catch(() => null)) as T | null
  if (!body || !Array.isArray((body as { results?: unknown }).results)) {
    throw new HubspotError(`malformed HubSpot response for ${path}`)
  }
  return body
}

function ownerDisplayName(o: HubspotOwnersPage['results'][number]): string {
  const full = [o.firstName, o.lastName].filter(Boolean).join(' ').trim()
  return full || o.email || ''
}

/**
 * Build an `ownerId → display name` map from `/crm/v3/owners`. Best-effort: an owners-endpoint failure
 * returns an empty map rather than aborting enrichment (id-valued agents then resolve to null; any
 * free-text agent is unaffected). Deal-search failures remain fatal (handled by the caller as outage).
 */
async function fetchOwnerNames(token: string, deadlineMs?: number): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    let after: string | undefined
    for (let pages = 0; pages < MAX_PAGES; pages += 1) {
      if (deadlineMs && Date.now() > deadlineMs) break
      const qs = `limit=${PAGE_LIMIT}${after ? `&after=${encodeURIComponent(after)}` : ''}`
      const body = await hubspotRequest<HubspotOwnersPage>(`/crm/v3/owners?${qs}`, token)
      for (const o of body.results) {
        const name = ownerDisplayName(o)
        if (o.id != null && name) map.set(String(o.id), name)
      }
      after = body.paging?.next?.after
      if (!after) break
    }
  } catch {
    return new Map() // best-effort — degrade owner-id resolution, don't fail the build
  }
  return map
}

/**
 * The CS agent display value. Empty/whitespace → null. A value found in the owners map resolves to the
 * owner's name; an unresolved bare-numeric value is an owner id we couldn't resolve (→ null, never
 * surface a raw id); any other text is used as-is.
 */
function resolveAgent(raw: unknown, owners: Map<string, string>): string | null {
  if (raw === null || raw === undefined) return null
  const value = String(raw).trim()
  if (value === '') return null
  const resolved = owners.get(value)
  if (resolved) return resolved
  if (/^\d+$/.test(value)) return null
  return value
}

/** Whole-number epoch ms for a deal's last-modified timestamp; unparseable → 0 (oldest). */
function lastModifiedMs(raw: unknown): number {
  if (raw === null || raw === undefined) return 0
  const ms = Date.parse(String(raw))
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Search the deals that carry a username and collapse them to one {@link OwnerRecord} per normalized
 * username. For each username we keep the owner from the most-recently-modified deal that names one.
 */
export async function fetchHubspotOwners(deadlineMs?: number): Promise<OwnerRecord[]> {
  const t0 = Date.now()
  const { token, usernameProperty, csProperty } = getConfig()
  const owners = await fetchOwnerNames(token, deadlineMs)

  // Per username key: the chosen record plus the modified-time of the deal that set its owner
  // (-Infinity while still ownerless, so the first agented deal always wins).
  const byKey = new Map<string, { record: OwnerRecord; ownerModifiedAt: number }>()

  let after: string | undefined
  let pagesDone = 0
  for (let pages = 0; pages < MAX_PAGES; pages += 1) {
    // Respeita o deadline global do build: se estourar, devolve os donos coletados até aqui (parcial).
    if (deadlineMs && Date.now() > deadlineMs) break
    const payload = {
      filterGroups: [{ filters: [{ propertyName: usernameProperty, operator: 'HAS_PROPERTY' }] }],
      properties: [usernameProperty, csProperty, LAST_MODIFIED_PROPERTY],
      limit: PAGE_LIMIT,
      ...(after ? { after } : {}),
    }
    const body = await hubspotRequest<HubspotPage>(
      '/crm/v3/objects/deals/search',
      token,
      { method: 'POST', body: JSON.stringify(payload) },
    )

    for (const d of body.results) {
      const username = typeof d.properties?.[usernameProperty] === 'string'
        ? (d.properties[usernameProperty] as string).trim()
        : ''
      const key = normalizeName(username)
      if (!key) continue // a deal without a username can't be joined to a restaurant

      const id = String(d.id ?? '')
      const agent = resolveAgent(d.properties?.[csProperty], owners)
      const modifiedAt = lastModifiedMs(d.properties?.[LAST_MODIFIED_PROPERTY])

      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          record: { id, name: username, normalizedName: key, owner: agent },
          ownerModifiedAt: agent !== null ? modifiedAt : Number.NEGATIVE_INFINITY,
        })
        continue
      }
      // Adopt this deal's agent only if it names one and is at least as recent as the current source.
      if (agent !== null && modifiedAt >= existing.ownerModifiedAt) {
        existing.record.id = id
        existing.record.name = username
        existing.record.owner = agent
        existing.ownerModifiedAt = modifiedAt
      }
    }

    pagesDone += 1
    after = body.paging?.next?.after
    if (!after) break
    await sleep(PAGE_THROTTLE_MS)
  }

  console.log(`[inatividade] HubSpot: ${byKey.size} usernames de ${pagesDone} páginas em ${Date.now() - t0}ms`)
  return [...byKey.values()].map((e) => e.record)
}
