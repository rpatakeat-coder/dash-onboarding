// Fila de retenção: a read-only, risk-ordered CS worklist. One card per scored restaurant, showing
// the churn score, the reason codes that explain it, the inactivity facts, and the CS owner. No
// actions/tracking — purely informational (login is a shared password). Filtering/sorting reuse
// lib/table.ts; only SCORED rows appear (unscored restaurants are dropped, like a numeric filter).

import { useMemo, useState } from 'react'
import type { ChurnFaixa, Restaurant } from '../lib/types'
import {
  filterRestaurants,
  sortRows,
  paginate,
  pageCount,
  EMPTY_FILTERS,
  type SortKey,
} from '../lib/table'
import { cardReasons } from '../lib/reasons'
import { dashIfNull } from '../lib/format'

const PAGE_SIZE = 20

interface RetentionQueueProps {
  rows: Restaurant[]
  owners: string[]
  scoresGeneratedAt?: string | null
}

// Faixa → accent bar + score color + badge style (mirrors the table's FAIXA palette).
const FAIXA_STYLE: Record<ChurnFaixa, { accent: string; score: string; badge: string }> = {
  Alto: { accent: '#D12B27', score: 'text-critico', badge: 'bg-brand-soft text-[#B91D18]' },
  Médio: { accent: '#E8920C', score: 'text-alerta', badge: 'bg-[#FFF7EC] text-[#8A5A07]' },
  Baixo: { accent: '#18A06B', score: 'text-ativo', badge: 'bg-[#E7F6EF] text-[#0F7A50]' },
}

const FAIXA_CHIPS: ReadonlyArray<{ key: ChurnFaixa | 'all'; label: string }> = [
  { key: 'Alto', label: 'Alto' },
  { key: 'Médio', label: 'Médio' },
  { key: 'Baixo', label: 'Baixo' },
  { key: 'all', label: 'Todas' },
]

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'risco', label: 'Risco ↓' },
  { key: 'inatividade', label: 'Inatividade ↓' },
  { key: 'ultimo', label: 'Último pedido' },
]

/** Two-letter initials for the owner avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '–'
}

/** `DD/MM/YYYY` date portion of a BRT `DD/MM/YYYY HH:MM` string. */
function dateOnly(s: string | null): string {
  return s ? s.split(' ')[0] : '—'
}

export default function RetentionQueue({ rows, owners, scoresGeneratedAt }: RetentionQueueProps) {
  const [owner, setOwner] = useState<string>('all')
  const [faixa, setFaixa] = useState<ChurnFaixa | 'all'>('Alto')
  const [sort, setSort] = useState<SortKey>('risco')
  const [page, setPage] = useState(1)

  // Only scored rows belong in the queue. Then apply owner/faixa filters and the chosen order.
  const queue = useMemo(() => {
    const scored = rows.filter((r) => r.prob_churn !== null && r.prob_churn !== undefined)
    const filtered = filterRestaurants(scored, { ...EMPTY_FILTERS, owner, faixa })
    return sortRows(filtered, sort, sort === 'ultimo' ? 'asc' : 'desc')
  }, [rows, owner, faixa, sort])

  const totalPages = pageCount(queue.length, PAGE_SIZE)
  const safePage = Math.min(page, totalPages)
  const pageRows = paginate(queue, safePage, PAGE_SIZE)

  function update<T>(setter: (v: T) => void, v: T) {
    setter(v)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13.5px] text-cmuted">
          <strong className="text-ink">{queue.length.toLocaleString('pt-BR')}</strong> restaurante(s)
          na fila · ordenado por {SORTS.find((s) => s.key === sort)?.label.toLowerCase()}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={owner}
            onChange={(e) => update(setOwner, e.target.value)}
            aria-label="Responsável CS"
            className="rounded-[9px] border border-line2 bg-white px-2.5 py-2 text-[13px] text-ink2 outline-none focus:border-brand"
          >
            <option value="all">Todos os responsáveis</option>
            <option value="none">Sem responsável</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <div className="flex gap-1.5">
            {FAIXA_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => update(setFaixa, c.key)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                  faixa === c.key
                    ? 'bg-ink text-white'
                    : 'border border-line2 bg-white text-cmuted hover:bg-surface'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => update(setSort, e.target.value as SortKey)}
            aria-label="Ordenar"
            className="rounded-[9px] border border-line2 bg-white px-2.5 py-2 text-[13px] text-ink2 outline-none focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* card list */}
      {pageRows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-14 text-center text-cmuted2">
          Nenhum restaurante nesta fila.
        </div>
      ) : (
        <div className="space-y-3">
          {pageRows.map((r) => {
            const fx = r.faixa_risco as ChurnFaixa
            const style = FAIXA_STYLE[fx]
            const chips = cardReasons(r)
            const noOwner = r.responsavel_cs === null
            return (
              <div
                key={r.restaurant_id}
                className="flex overflow-hidden rounded-2xl border border-line bg-white transition hover:border-line2 hover:shadow-[0_6px_22px_rgba(28,26,24,.07)]"
              >
                <div className="w-1.5 shrink-0" style={{ background: style.accent }} />
                <div className="flex-1 p-[18px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[15.5px] font-extrabold text-ink">{r.restaurante}</span>
                    <span className="text-[12px] text-faint">#{r.restaurant_id}</span>
                    <span className={`tabular-nums text-[15px] font-extrabold ${style.score}`}>
                      {(r.prob_churn ?? 0).toFixed(0)}%
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${style.badge}`}>
                      {fx}
                    </span>
                  </div>

                  {chips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {chips.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-2 rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-ink2"
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.accent }} />
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-cmuted">
                    <span>Último pedido: <strong className="font-bold text-ink2">{dateOnly(r.ultimo_pedido)}</strong></span>
                    <span>Inatividade: <strong className="tabular-nums font-bold text-ink2">{dashIfNull(r.dias_inativo)}{typeof r.dias_inativo === 'number' ? ' dias' : ''}</strong></span>
                    <span>Cliente desde: <strong className="font-bold text-ink2">{dateOnly(r.criado_em)}</strong></span>
                  </div>
                </div>

                <div className="flex min-w-[170px] flex-col items-end justify-center gap-1.5 border-l border-line bg-[#FCFBFA] px-5 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-faint">Responsável CS</span>
                  {noOwner ? (
                    <span className="flex items-center gap-2 text-[13.5px] font-bold text-alerta">
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#FFF7EC] text-[12px] font-extrabold text-alerta">!</span>
                      Sem responsável
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand-soft text-[12px] font-extrabold text-brand">
                        {initials(r.responsavel_cs as string)}
                      </span>
                      {r.responsavel_cs}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* pager + footnote */}
      {queue.length > 0 && (
        <div className="flex items-center justify-between px-1 text-[12.5px] text-cmuted">
          <span>
            Página <strong className="text-ink">{safePage}</strong> de {totalPages}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage <= 1}
              className="rounded-[9px] border border-line2 px-3 py-1.5 font-medium text-ink2 transition hover:bg-surface disabled:cursor-not-allowed disabled:text-[#C9C4BD] disabled:hover:bg-transparent"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="rounded-[9px] border border-line2 px-3 py-1.5 font-medium text-ink2 transition hover:bg-surface disabled:cursor-not-allowed disabled:text-[#C9C4BD] disabled:hover:bg-transparent"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <p className="text-[12px] text-faint">
        Faixa <strong className="text-cmuted">Alto</strong> = 60,9% de churn real observado.
        {scoresGeneratedAt && ` Score preditivo de ${scoresGeneratedAt}.`} Motivos derivados dos sinais
        do modelo (uso, silêncio, GMV).
      </p>
    </div>
  )
}
