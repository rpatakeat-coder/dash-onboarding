// Tracks the "Atualizado em" timestamp shown no header.
// Atualiza apenas em duas ocasiões:
//   1. Todo dia às 06:00 (horário do fluxo automático)
//   2. Quando o usuário clica em "Atualizar dados"
const STORAGE_KEY = "dash_last_updated_at";
const EVENT_NAME = "dash:last-updated-changed";

/** Retorna o timestamp (ms) da última ocorrência de 06:00 que já passou. */
export function lastSixAm(now: Date = new Date()): number {
  const six = new Date(now);
  six.setHours(6, 0, 0, 0);
  if (six.getTime() > now.getTime()) {
    six.setDate(six.getDate() - 1);
  }
  return six.getTime();
}

/** Lê o timestamp efetivo: o maior entre o clique do usuário e o último 6h. */
export function getEffectiveLastUpdated(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY) || 0);
  return Math.max(stored, lastSixAm());
}

/** Marca o instante atual como nova atualização (chamado pelo botão). */
export function markUserRefresh(): void {
  const now = Date.now();
  localStorage.setItem(STORAGE_KEY, String(now));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export const LAST_UPDATED_EVENT = EVENT_NAME;
