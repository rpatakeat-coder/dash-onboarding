// Reason chips for a Fila de retenção card. The model-derived reasons (usage decline, GMV trend,
// cliente novo) arrive on the row via the churn contract; the inactivity reason is derived HERE from
// the precise daily `dias_inativo` (the model's aggregates are monthly, so daily silence is better
// sourced from the row the dashboard already has). The inactivity chip leads, then the model reasons.

import type { Restaurant } from './types'

/** Up to `max` reason chips for a card: inactivity first, then the model's reasons. */
export function cardReasons(r: Restaurant, max = 4): string[] {
  const out: string[] = []
  if (r.dias_inativo === null && r.ultimo_pedido === null) {
    out.push('Nunca fez pedido')
  } else if (typeof r.dias_inativo === 'number' && r.dias_inativo >= 8) {
    out.push(`${r.dias_inativo} dias em silêncio`)
  }
  for (const m of r.reasons ?? []) out.push(m)
  return out.slice(0, max)
}
