// Table controls: search (name/ID), status chips, owner dropdown (AC-017/018/019). The owner options
// come from the full-universe `dataset.owners` so they stay stable as the table is filtered (M1).

import type { ChurnFaixa, RiskBandKey } from '../lib/types'
import type { TableFilters } from '../lib/table'
import { KEY_TO_LABEL, RISK_BAND_KEYS } from '../lib/risk'

interface FiltersProps {
  filters: TableFilters
  owners: string[]
  onChange: (next: TableFilters) => void
}

const BAND_CHIPS: Array<{ key: RiskBandKey | 'all'; label: string }> = [
  { key: 'all', label: 'Todos' },
  ...RISK_BAND_KEYS.map((key) => ({ key, label: KEY_TO_LABEL[key] })),
]

const FAIXA_CHIPS: Array<{ key: ChurnFaixa | 'all'; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'Alto', label: 'Alto' },
  { key: 'Médio', label: 'Médio' },
  { key: 'Baixo', label: 'Baixo' },
]

export default function Filters({ filters, owners, onChange }: FiltersProps) {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-[42px] items-center gap-2.5 rounded-[11px] border border-line2 bg-white px-3.5 focus-within:border-cmuted2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A39D" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar por nome ou ID…"
            aria-label="Buscar por nome ou ID"
            className="w-56 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-cmuted2"
          />
        </div>
        <select
          aria-label="Responsável CS"
          value={filters.owner}
          onChange={(e) => onChange({ ...filters, owner: e.target.value })}
          className="h-[42px] rounded-[11px] border border-line2 bg-white px-3.5 text-[13.5px] font-medium text-ink2 outline-none focus:border-cmuted2"
        >
          <option value="all">Todos os responsáveis</option>
          <option value="none">Sem responsável</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {BAND_CHIPS.map((chip) => {
          const active = filters.band === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange({ ...filters, band: chip.key })}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                active
                  ? 'bg-brand text-white'
                  : 'border border-line2 bg-white text-faint hover:bg-surface'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[.05em] text-cmuted2">Risco</span>
        {FAIXA_CHIPS.map((chip) => {
          const active = filters.faixa === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange({ ...filters, faixa: chip.key })}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                active
                  ? 'bg-ink text-white'
                  : 'border border-line2 bg-white text-faint hover:bg-surface'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
