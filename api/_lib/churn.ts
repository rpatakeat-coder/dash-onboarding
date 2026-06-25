// Churn-score enrichment (TCC model). Joins a predictive churn probability + risk tier onto each
// restaurant by `restaurant_id`, mirroring the HubSpot owner overlay in `restaurants.ts`.
//
// SOURCE (today): a bundled snapshot of the TCC proof-of-concept scores (`data/churn-scores.json`,
// keyed on the real restaurant_id). It is a STATIC batch from a single cutoff — labeled as such in
// the UI via `scores_generated_at`.
//
// SOURCE (next — "Option B", native scoring): the same model exported to `data/churn-model.json`
// (imputer medians + scaler mean/scale + logistic coefficients; verified to reproduce the Python
// pipeline to 1e-16). A nightly job computes the 15 features from live data and scores in TS, writing
// the same `{ restaurant_id: { prob, faixa } }` contract this module reads — so nothing downstream
// changes when the source goes live.

import type { ChurnFaixa, Restaurant } from '../../src/features/inatividade/lib/types'
import scoresData from '../../data/churn-scores.json' with { type: 'json' }

interface ScoreEntry {
  prob: number
  faixa: ChurnFaixa
  reasons?: string[]
}

const SCORES = scoresData.scores as Record<string, ScoreEntry>
const SCORED_AT: string | null = scoresData.scored_at ?? null

export interface ChurnEnrichResult {
  data: Restaurant[]
  scores_generated_at: string | null
}

/**
 * Overlay churn scores onto rows by `restaurant_id`. Pure and total: unscored restaurants get
 * `null` (never throws), so a missing/partial score set never affects the rest of the dataset.
 */
export function enrichWithChurn(data: Restaurant[]): ChurnEnrichResult {
  const enriched = data.map((r) => {
    const s = SCORES[String(r.restaurant_id)]
    return s
      ? { ...r, prob_churn: s.prob, faixa_risco: s.faixa, reasons: s.reasons ?? [] }
      : { ...r, prob_churn: null, faixa_risco: null, reasons: null }
  })
  return { data: enriched, scores_generated_at: SCORED_AT }
}
