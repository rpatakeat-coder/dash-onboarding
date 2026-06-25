// The restaurant table: sortable by inactivity (reactive) or ML churn risk (predictive),
// client-paginated over the filtered set (AC-020/021). Rendering only — filtering/sorting/pagination
// math lives in `lib/table.ts`.

import type { ChurnFaixa, Restaurant, RiskBandKey } from '../lib/types'
import type { SortDir, SortKey } from '../lib/table'
import { dashIfNull } from '../lib/format'
import { keyFromLabel, KEY_TO_SHORT_LABEL } from '../lib/risk'

interface RestaurantTableProps {
  rows: Restaurant[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  totalFiltered: number
}

// Status badge per rule-based band — soft tinted pill + a saturated status dot.
const BADGE: Record<RiskBandKey, { pill: string; dot: string }> = {
  critico: { pill: 'bg-brand-soft text-[#B91D18]', dot: '#D12B27' },
  alerta: { pill: 'bg-[#FFF7EC] text-[#8A5A07]', dot: '#E8920C' },
  ativo: { pill: 'bg-[#E7F6EF] text-[#0F7A50]', dot: '#18A06B' },
  nunca_movimentou: { pill: 'bg-[#F1EFEC] text-faint', dot: '#ABA59E' },
  recem_criado: { pill: 'bg-[#EAF1FE] text-[#2C5AB8]', dot: '#3D7BF0' },
}

// ML churn tier → pill + value color.
const FAIXA: Record<ChurnFaixa, { pill: string; text: string }> = {
  Alto: { pill: 'bg-brand-soft text-[#B91D18]', text: 'text-critico' },
  Médio: { pill: 'bg-[#FFF7EC] text-[#8A5A07]', text: 'text-alerta' },
  Baixo: { pill: 'bg-[#E7F6EF] text-[#0F7A50]', text: 'text-ativo' },
}

function StatusBadge({ label }: { label: string }) {
  const key = keyFromLabel(label)
  const style = key ? BADGE[key] : { pill: 'bg-surface text-faint', dot: '#A8A39D' }
  const text = key ? KEY_TO_SHORT_LABEL[key] : label
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.pill}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {text}
    </span>
  )
}

function ChurnCell({ prob, faixa }: { prob?: number | null; faixa?: ChurnFaixa | null }) {
  if (prob === null || prob === undefined || !faixa) {
    return <span className="text-cmuted2">—</span>
  }
  const style = FAIXA[faixa]
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`tabular-nums font-bold ${style.text}`}>{prob.toFixed(0)}%</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.pill}`}>{faixa}</span>
    </span>
  )
}

const TH = 'px-[18px] py-3 text-[11px] font-bold uppercase tracking-[.05em] text-cmuted2'
const TD = 'px-[18px] py-3.5'

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sortKey === col
  const arrow = active ? (sortDir === 'desc' ? '↓' : '↑') : ''
  return (
    <th className={`${TH} ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-[.05em] hover:text-faint ${active ? 'text-faint' : ''}`}
        aria-label={`Ordenar por ${label} (${active && sortDir === 'asc' ? 'crescente' : 'decrescente'})`}
      >
        {label} {arrow}
      </button>
    </th>
  )
}

export default function RestaurantTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  page,
  pageCount,
  onPageChange,
  totalFiltered,
}: RestaurantTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-[#FAF9F7]">
            <tr>
              <th className={TH}>ID</th>
              <th className={TH}>Restaurante</th>
              <th className={TH}>Responsável CS</th>
              <SortHeader label="Criado em" col="criado" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Último pedido" col="ultimo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Inatividade" col="inatividade" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
              <th className={TH}>Status</th>
              <SortHeader label="Risco" col="risco" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-[18px] py-10 text-center text-cmuted2">
                  Nenhum restaurante encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.restaurant_id} className="border-b border-[#F4F2EF] last:border-0 hover:bg-surface">
                  <td className={`${TD} tabular-nums text-cmuted2`}>{r.restaurant_id}</td>
                  <td className={`${TD} font-bold text-ink`}>{r.restaurante}</td>
                  <td className={`${TD} text-faint`}>{r.responsavel_cs ?? '—'}</td>
                  <td className={`${TD} tabular-nums text-cmuted`}>{r.criado_em}</td>
                  <td className={`${TD} tabular-nums text-faint`}>{dashIfNull(r.ultimo_pedido)}</td>
                  <td className={`${TD} tabular-nums text-right font-bold text-ink`}>{dashIfNull(r.dias_inativo)}</td>
                  <td className={TD}>
                    <StatusBadge label={r.status_risco} />
                  </td>
                  <td className={TD}>
                    <ChurnCell prob={r.prob_churn} faixa={r.faixa_risco} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-line px-[18px] py-3.5 text-[12.5px] text-cmuted">
        <span>
          <strong className="text-ink">{totalFiltered.toLocaleString('pt-BR')}</strong> resultado(s)
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-[9px] border border-line2 px-3 py-1.5 font-medium text-ink2 transition hover:bg-surface disabled:cursor-not-allowed disabled:text-[#C9C4BD] disabled:hover:bg-transparent"
          >
            Anterior
          </button>
          <span>
            Página <strong className="text-ink">{page}</strong> de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="rounded-[9px] border border-line2 px-3 py-1.5 font-medium text-ink2 transition hover:bg-surface disabled:cursor-not-allowed disabled:text-[#C9C4BD] disabled:hover:bg-transparent"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  )
}
