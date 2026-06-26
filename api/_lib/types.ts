// Domain types for the Churn Tracker, shared by the serverless API (`api/`) and the SPA (`src/`).
// These mirror the `inactive-risk` contract (see `inactive-risk.md` / `Query.md`). Keep this file
// type-only (no runtime exports) so consumers import it with `import type`.

/** The five risk bands, by their query-string KEY (not the human label). First-match-wins order. */
export type RiskBandKey =
  | 'recem_criado'
  | 'nunca_movimentou'
  | 'ativo'
  | 'alerta'
  | 'critico'

/**
 * One row of the upstream `inactive-risk` `data[]` payload, exactly as the HTTP API returns it.
 * `dias_inativo` is an integer or `null` over the wire (the `'—'` in `Query.md` is raw-SQL only —
 * see C4 in the acceptance brief); ingestion normalizes it via `parseDiasInativo`.
 */
export interface RawRiskRow {
  restaurant_id: number
  /** Restaurant display name. */
  restaurante: string
  /** Creation timestamp, BRT, formatted `DD/MM/YYYY HH:MM`. */
  criado_em: string
  /** Last-order timestamp, BRT `DD/MM/YYYY HH:MM`, or `null` if the restaurant never moved. */
  ultimo_pedido: string | null
  /** Whole days since last order in BRT; `null` when never moved. */
  dias_inativo: number | null
  /** Human-readable band label, e.g. `Crítico (+30 dias)` (the query filter uses the KEY instead). */
  status_risco: string
}

/** ML churn-risk tier from the TCC model (`prob_churn` cut at 20% / 50%). */
export type ChurnFaixa = 'Baixo' | 'Médio' | 'Alto'

/** A risk row enriched with its HubSpot CS owner (added in S4; `null` until then / when unmatched). */
export interface Restaurant extends RawRiskRow {
  responsavel_cs: string | null
  /**
   * Predictive churn probability (0–100) from the TCC model, joined by `restaurant_id`. Optional and
   * `null` when the restaurant has no score (e.g. not active at the scoring cutoff). Complements the
   * reactive `dias_inativo` signal: this flags decline *before* it shows up as inactivity.
   */
  prob_churn?: number | null
  /** Risk tier derived from `prob_churn`; absent/`null` when unscored. */
  faixa_risco?: ChurnFaixa | null
  /**
   * Human-readable reason codes explaining the score (e.g. "Sessões caíram 62% vs média"),
   * derived from the model's feature values at the scoring cutoff. Empty/absent when unscored.
   * The "X dias em silêncio" reason is NOT here — the app derives it from `dias_inativo`.
   */
  reasons?: string[] | null
}

/** Per-band counts over the full universe (mirrors the upstream `summary` block). */
export type BandCounts = Record<RiskBandKey, number>

/** The full enriched dataset the SPA consumes from `GET /api/restaurants`. */
export interface Dataset {
  /** ISO-8601 timestamp with offset (from upstream `meta.generated_at`), São Paulo time. */
  generated_at: string
  /** Full-universe per-band counts, ignoring filters/pagination (upstream `summary` semantics). */
  summary: BandCounts
  /** Distinct CS owners present in `data`, for the owner filter dropdown. */
  owners: string[]
  /** The full restaurant universe (after the endpoint's mandatory exclusions), enriched. */
  data: Restaurant[]
  /** True when this dataset was served from the durable cache during a degradation (AC-009). */
  stale: boolean
  /** Non-fatal warnings to surface (e.g. HubSpot unavailable, unmatched-owner count). */
  warnings: string[]
  /** When the joined churn scores were generated (`YYYY-MM-DD`); `null`/absent when unavailable. */
  scores_generated_at?: string | null
}
