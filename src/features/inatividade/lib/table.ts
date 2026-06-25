// Pure table-view transforms: filter, sort, paginate (AC-017..021). The table is the only surface
// that responds to filters (A-5); KPIs/charts use the full universe. Split out of the components so
// the behavior is unit-testable.

import type { ChurnFaixa, Restaurant, RiskBandKey } from './types'
import { bandFromRow } from './risk'
import { normalizeName, parseBrtDateTime } from './format'

/** Owner filter sentinels: every owner, or specifically the unmatched ("sem responsável") rows. */
export type OwnerFilter = string | 'all' | 'none'

export interface TableFilters {
  /** Free text: matches `restaurante` (accent/case-insensitive) or a `restaurant_id` prefix. */
  search: string
  /** A band key, or 'all'. */
  band: RiskBandKey | 'all'
  /** An owner name, 'all', or 'none' (sem responsável). */
  owner: OwnerFilter
  /** An ML churn tier, or 'all'. A specific tier excludes unscored rows (like a numeric filter). */
  faixa: ChurnFaixa | 'all'
}

export const EMPTY_FILTERS: TableFilters = { search: '', band: 'all', owner: 'all', faixa: 'all' }

/** Apply search + band + owner + churn-tier filters (AC-017/018/019). */
export function filterRestaurants(data: Restaurant[], f: TableFilters): Restaurant[] {
  const q = f.search.trim()
  const nq = normalizeName(q)
  const isNumeric = /^\d+$/.test(q)
  return data.filter((r) => {
    if (f.band !== 'all' && bandFromRow(r) !== f.band) return false
    if (f.faixa !== 'all' && r.faixa_risco !== f.faixa) return false
    if (f.owner === 'none') {
      if (r.responsavel_cs !== null) return false
    } else if (f.owner !== 'all') {
      if (r.responsavel_cs !== f.owner) return false
    }
    if (q !== '') {
      const nameMatch = nq !== '' && normalizeName(r.restaurante).includes(nq)
      const idMatch = isNumeric && String(r.restaurant_id).startsWith(q) // prefix match (M2)
      if (!nameMatch && !idMatch) return false
    }
    return true
  })
}

export type SortDir = 'asc' | 'desc'
/** Which column drives the table order. */
export type SortKey = 'inatividade' | 'risco' | 'criado' | 'ultimo'

/** Sort by the chosen column: inactivity, churn score, or either BRT date column. */
export function sortRows(data: Restaurant[], key: SortKey, dir: SortDir): Restaurant[] {
  switch (key) {
    case 'risco':
      return sortByChurn(data, dir)
    case 'criado':
      return sortByDate(data, 'criado_em', dir)
    case 'ultimo':
      return sortByDate(data, 'ultimo_pedido', dir)
    default:
      return sortByInactivity(data, dir)
  }
}

/** A BRT `DD/MM/YYYY HH:MM` string as a comparable epoch (ms), or `null` if unparseable/absent. */
function brtSortValue(value: string | null | undefined): number | null {
  const p = parseBrtDateTime(value)
  return p ? Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) : null
}

/**
 * Sort by a BRT date column (`criado_em` or `ultimo_pedido`). Rows with no/unparseable date
 * (e.g. a never-moved restaurant's `ultimo_pedido`) always sort LAST, regardless of direction.
 */
export function sortByDate(
  data: Restaurant[],
  field: 'criado_em' | 'ultimo_pedido',
  dir: SortDir = 'desc',
): Restaurant[] {
  return [...data].sort((a, b) => {
    const av = brtSortValue(a[field])
    const bv = brtSortValue(b[field])
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return dir === 'desc' ? bv - av : av - bv
  })
}

/**
 * Sort by `dias_inativo`. Default `desc` places nulls FIRST (the upstream contract — never-moved
 * restaurants lead); `asc` places nulls last. Returns a new array (input untouched) (AC-020).
 */
export function sortByInactivity(data: Restaurant[], dir: SortDir = 'desc'): Restaurant[] {
  return [...data].sort((a, b) => {
    const av = a.dias_inativo
    const bv = b.dias_inativo
    if (av === null && bv === null) return 0
    if (av === null) return dir === 'desc' ? -1 : 1
    if (bv === null) return dir === 'desc' ? 1 : -1
    return dir === 'desc' ? bv - av : av - bv
  })
}

/** Sort by `prob_churn`. Unscored rows (`null`) always sort LAST, regardless of direction. */
export function sortByChurn(data: Restaurant[], dir: SortDir = 'desc'): Restaurant[] {
  return [...data].sort((a, b) => {
    const av = a.prob_churn ?? null
    const bv = b.prob_churn ?? null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return dir === 'desc' ? bv - av : av - bv
  })
}

/** A page (1-indexed) of `items` (AC-021). */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

/** Number of pages for `total` items at `pageSize` (at least 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
