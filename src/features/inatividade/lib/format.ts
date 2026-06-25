// Pure formatting/parsing helpers shared by the API and the SPA. No I/O.

/**
 * Normalize a name for matching: lowercase, strip accents (NFD), drop every non-alphanumeric char.
 * Used to join restaurants to HubSpot companies by name (S4).
 *   normalizeName('Cia do Peixe')   === 'ciadopeixe'
 *   normalizeName('Açaí da Praça')  === 'acaidapraca'
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Parse the wire `dias_inativo` into a number or `null`. Treats `null`/`undefined`, the em-dash
 * `'—'`, empty/whitespace, and any non-integer string as "no value" (C4). Numbers pass through
 * when finite. Only integer-looking strings are accepted (e.g. `'1.5'` → `null`).
 */
export function parseDiasInativo(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === '—') return null
    if (!/^-?\d+$/.test(trimmed)) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Display a possibly-null value, rendering `null`/`undefined` as an em-dash. */
export function dashIfNull(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value)
}

/** The component parts of a BRT `DD/MM/YYYY HH:MM` timestamp. */
export interface BrtParts {
  year: number
  /** 1-12. */
  month: number
  /** 1-31. */
  day: number
  /** 0-23. */
  hour: number
  /** 0-59. */
  minute: number
}

const BRT_DATETIME_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/

/**
 * Parse a BRT `DD/MM/YYYY HH:MM` string (as the endpoint returns `criado_em`/`ultimo_pedido`) into
 * its parts. Returns `null` for empty/null input or any malformed/out-of-range value.
 */
export function parseBrtDateTime(value: string | null | undefined): BrtParts | null {
  if (!value) return null
  const m = BRT_DATETIME_RE.exec(value.trim())
  if (!m) return null
  const [, dd, mm, yyyy, hh, min] = m
  const parts: BrtParts = {
    day: Number(dd),
    month: Number(mm),
    year: Number(yyyy),
    hour: Number(hh),
    minute: Number(min),
  }
  if (
    parts.month < 1 || parts.month > 12 ||
    parts.day < 1 || parts.day > 31 ||
    parts.hour > 23 || parts.minute > 59
  ) {
    return null
  }
  return parts
}

/** `'YYYY-MM'` month key from a BRT `DD/MM/YYYY HH:MM` string (for monthly aggregation); `null` if unparseable. */
export function brtMonthKey(value: string | null | undefined): string | null {
  const parts = parseBrtDateTime(value)
  if (parts === null) return null
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

/**
 * Format an ISO-8601 instant (with offset, e.g. the dataset's `generated_at`) as a BRT
 * `DD/MM/YYYY HH:MM` display string. Returns `'—'` for empty/invalid input.
 */
export function formatBrtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}
