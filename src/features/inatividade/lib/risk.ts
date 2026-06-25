// Risk-band contract, encoded exactly once. See `inactive-risk.md` (band table) and `Query.md`
// (the `CASE`). Two faces of a band: the query-string KEY (e.g. `critico`) and the human LABEL
// (e.g. `Crítico (+30 dias)`).
//
// `bandFromRow` is the contract-faithful path: it maps the upstream `status_risco` LABEL to a key.
// The upstream owns classification (it applies the rule below with authoritative BRT date math),
// so trusting its label is what guarantees we never disagree with it (AC-006).
//
// `classifyRisk` re-encodes the documented first-match-wins rule from raw signals. It is the single
// source of truth for the RULE itself — used for verification/parity and any client-side need.

import type { RawRiskRow, RiskBandKey } from './types'

/** All band keys in first-match-wins evaluation order. */
export const RISK_BAND_KEYS: readonly RiskBandKey[] = [
  'recem_criado',
  'nunca_movimentou',
  'ativo',
  'alerta',
  'critico',
] as const

/** KEY → human label exactly as the endpoint emits it (note the en-dash in the Alerta range). */
export const KEY_TO_LABEL: Record<RiskBandKey, string> = {
  recem_criado: 'Recém-criado (< 7 dias)',
  nunca_movimentou: 'Nunca movimentou',
  ativo: 'Ativo (até 7 dias)',
  alerta: 'Alerta (8–30 dias)',
  critico: 'Crítico (+30 dias)',
}

/** Brand accent per band — single source for charts, legends, and table badges so they never drift. */
export const BAND_COLOR: Record<RiskBandKey, string> = {
  recem_criado: '#3D7BF0',
  nunca_movimentou: '#ABA59E',
  ativo: '#18A06B',
  alerta: '#E8920C',
  critico: '#D12B27',
}

/** Short band labels for the donut legend / compact chips (the full labels carry the day ranges). */
export const KEY_TO_SHORT_LABEL: Record<RiskBandKey, string> = {
  recem_criado: 'Recém-criado',
  nunca_movimentou: 'Nunca movimentou',
  ativo: 'Ativo',
  alerta: 'Alerta',
  critico: 'Crítico',
}

/** Inverse of {@link KEY_TO_LABEL}: human label → KEY. */
export const LABEL_TO_KEY: Record<string, RiskBandKey> = Object.fromEntries(
  RISK_BAND_KEYS.map((key) => [KEY_TO_LABEL[key], key]),
) as Record<string, RiskBandKey>

/** Type guard for the query-string `status_risco` values (unknown → caller should 400). */
export function isRiskBandKey(value: string): value is RiskBandKey {
  return (RISK_BAND_KEYS as readonly string[]).includes(value)
}

/** The human label for a band key. */
export function bandLabel(key: RiskBandKey): string {
  return KEY_TO_LABEL[key]
}

/** Map an upstream label back to its key; `null` if the label is not one of the five. */
export function keyFromLabel(label: string): RiskBandKey | null {
  return LABEL_TO_KEY[label.trim()] ?? null
}

/**
 * The band key for an upstream row, derived from its `status_risco` label (faithful by construction).
 * Throws on an unrecognized label rather than guessing — a loud failure beats a silent miscategory.
 */
export function bandFromRow(row: Pick<RawRiskRow, 'status_risco'>): RiskBandKey {
  const key = keyFromLabel(row.status_risco)
  if (key === null) {
    throw new Error(`Unknown status_risco label: ${JSON.stringify(row.status_risco)}`)
  }
  return key
}

/** Raw signals the upstream `CASE` evaluates, in BRT whole-day terms. */
export interface ClassifyInput {
  /** Whole days since creation (BRT). */
  diasDesdeCriacao: number
  /** Last-order timestamp (or `null` if the restaurant never moved). */
  ultimoPedido: string | null
  /** Whole days since last order (BRT); `null` when never moved. */
  diasInativo: number | null
}

/**
 * The documented first-match-wins rule (mirrors the `CASE` in `Query.md`):
 *   recem_criado (created ≤ 7d) → nunca_movimentou (no order) → ativo (≤7) → alerta (≤30) → critico.
 * `recem_criado` is checked before everything, so a ≤7-day-old restaurant with no order is
 * `recem_criado`, not `nunca_movimentou`.
 */
export function classifyRisk(input: ClassifyInput): RiskBandKey {
  const { diasDesdeCriacao, ultimoPedido, diasInativo } = input
  if (diasDesdeCriacao <= 7) return 'recem_criado'
  if (ultimoPedido === null || diasInativo === null) return 'nunca_movimentou'
  if (diasInativo <= 7) return 'ativo'
  if (diasInativo <= 30) return 'alerta'
  return 'critico'
}
