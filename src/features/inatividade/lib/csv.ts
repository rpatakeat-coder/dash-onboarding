// CSV export of the current table view (AC-022). UTF-8 with a BOM so Excel renders accented names
// correctly (M5). Only the seven public columns — never internal/secret fields.

import type { Restaurant } from './types'

const COLUMNS = [
  'restaurant_id',
  'restaurante',
  'responsavel_cs',
  'criado_em',
  'ultimo_pedido',
  'dias_inativo',
  'status_risco',
] as const

const BOM = '﻿'

/** Quote a cell if it contains a comma, quote, or newline (RFC-4180). */
function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Serialize the given rows to a CSV string (header + rows), BOM-prefixed. Nulls render empty. */
export function toCsv(rows: Restaurant[]): string {
  const header = COLUMNS.join(',')
  const lines = rows.map((r) =>
    COLUMNS.map((col) => {
      const value = r[col]
      return escapeCell(value === null || value === undefined ? '' : String(value))
    }).join(','),
  )
  return BOM + [header, ...lines].join('\r\n')
}

/** Dated export filename, e.g. `monitor-inatividade-2026-06-20.csv`. */
export function csvFilename(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `monitor-inatividade-${y}-${m}-${d}.csv`
}

/** Trigger a browser download of `content` as `filename` (no-op-safe outside a DOM). */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
