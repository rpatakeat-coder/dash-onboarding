// Joins restaurants to their CS owner (S4). Pure and deterministic — never throws, never does I/O.
//
// Rules (AC-010/011/012):
//   1. A manual alias keyed by `restaurant_id` (data/cs-aliases.json) wins unconditionally.
//   2. Otherwise an exact normalized-name match against HubSpot owner records (one per deal username).
//      Exactly one candidate with a non-null owner → that owner. Zero, more than one, or a single
//      candidate with no CS value → null (the documented deterministic tie-break: ambiguity is never
//      guessed away). Note: the deal-username dedup upstream already guarantees ≤1 record per name.
// Unmatched rows still appear; the count of `null` owners is returned so the dashboard can surface
// "N sem responsável CS".

import { normalizeName } from './format.js'
import type { Restaurant } from './types.js'
import type { OwnerRecord } from './hubspot.js'

export interface MatchOutcome {
  /** Input rows, copied with `responsavel_cs` filled in (input is never mutated). */
  data: Restaurant[]
  /** Distinct non-null owners present, sorted (pt-BR) — for the owner filter dropdown. */
  owners: string[]
  /** Count of rows resolved to no owner. */
  semResponsavel: number
}

function aliasOwner(aliases: Record<string, string>, restaurantId: number): string | null {
  const raw = aliases[String(restaurantId)]
  if (raw === undefined || raw === null) return null
  const value = String(raw).trim()
  return value === '' ? null : value
}

export function matchOwners(args: {
  restaurants: Restaurant[]
  companies: OwnerRecord[]
  aliases: Record<string, string>
}): MatchOutcome {
  const { restaurants, companies, aliases } = args

  // Index records by normalized name; a name mapping to >1 record is ambiguous.
  const byName = new Map<string, OwnerRecord[]>()
  for (const c of companies) {
    const list = byName.get(c.normalizedName)
    if (list) list.push(c)
    else byName.set(c.normalizedName, [c])
  }

  let semResponsavel = 0
  const ownerSet = new Set<string>()

  const data = restaurants.map((r) => {
    const owner = resolveOwnerFor(r, byName, aliases)
    if (owner === null) semResponsavel += 1
    else ownerSet.add(owner)
    return { ...r, responsavel_cs: owner }
  })

  const owners = [...ownerSet].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { data, owners, semResponsavel }
}

function resolveOwnerFor(
  r: Restaurant,
  byName: Map<string, OwnerRecord[]>,
  aliases: Record<string, string>,
): string | null {
  const alias = aliasOwner(aliases, r.restaurant_id)
  if (alias !== null) return alias // alias override wins (AC-011)

  const candidates = byName.get(normalizeName(r.restaurante))
  if (!candidates || candidates.length !== 1) return null // zero or ambiguous → null (AC-012)
  return candidates[0].owner // null when the single match has no CS value (AC-012)
}
