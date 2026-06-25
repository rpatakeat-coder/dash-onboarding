// Durable daily cache for the enriched dataset. The store is Vercel KV (Upstash-style REST) so the
// last-good dataset survives serverless cold starts (C5); an in-memory store is the fallback for
// local dev / tests only. The cache bounds upstream load to ~once per day (AC-007) and retains the
// last-good entry past freshness so the route can degrade to stale on dependency failure (AC-009A).

import type { Dataset } from '../../src/features/inatividade/lib/types'

/** Freshness window: serve from cache without rebuilding for 24h. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_KEY = 'churn:dataset'

/** Minimal key/value contract so the orchestration is testable without a live KV. */
export interface KvStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
}

export interface CachedDataset {
  dataset: Dataset
  /** When this entry was written, epoch ms. */
  storedAt: number
}

/** Build a KvStore over the Vercel KV REST API, or `null` when it isn't configured. */
export function restKvStore(): KvStore | null {
  // The Vercel Marketplace Upstash integration injects either the KV_* (legacy Vercel KV) or the
  // UPSTASH_REDIS_REST_* names depending on how the store is connected — accept whichever is present.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  async function command(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(url as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!res.ok) throw new Error(`KV ${args[0]} failed: ${res.status}`)
    return ((await res.json()) as { result: unknown }).result
  }

  return {
    async get(key) {
      const result = await command(['GET', key])
      return typeof result === 'string' ? result : null
    },
    async set(key, value, ttlSeconds) {
      await command(ttlSeconds ? ['SET', key, value, 'EX', ttlSeconds] : ['SET', key, value])
    },
  }
}

const memory = new Map<string, string>()

/** Process-local store. Does NOT survive cold starts — fallback for dev/tests only. */
export function memoryKvStore(): KvStore {
  return {
    async get(key) {
      return memory.has(key) ? (memory.get(key) as string) : null
    },
    async set(key, value) {
      memory.set(key, value)
    },
  }
}

/** Prefer durable KV; fall back to in-memory when KV env is absent. */
export function getDefaultStore(): KvStore {
  return restKvStore() ?? memoryKvStore()
}

export async function readCachedDataset(store: KvStore): Promise<CachedDataset | null> {
  const raw = await store.get(CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CachedDataset
  } catch {
    return null
  }
}

export async function writeCachedDataset(store: KvStore, dataset: Dataset, storedAt: number): Promise<void> {
  // Keep the entry alive for 2× the freshness window so a last-good copy remains for degradation.
  const ttlSeconds = Math.ceil((CACHE_TTL_MS * 2) / 1000)
  await store.set(CACHE_KEY, JSON.stringify({ dataset, storedAt }), ttlSeconds)
}

/** True while the entry is still within the freshness window. */
export function isFresh(storedAt: number, nowMs: number): boolean {
  return nowMs - storedAt < CACHE_TTL_MS
}
