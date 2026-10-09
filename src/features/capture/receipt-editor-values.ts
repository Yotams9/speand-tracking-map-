import { reviewCurrencies } from './session-purchase-domain'

// Format conversion only. Originals stay in ReceiptReviewDraft.observations.
// No locale guess, two-digit year expansion, rollover or timezone inference.
export function receiptEditorDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const printed = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(printed)
  const dmy = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(printed)
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[4], dmy[3], dmy[1]] : null
  if (!parts) return ''
  const [year, month, day] = parts.map(Number)
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return ''
  const date = parts.join('-')
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date ? date : ''
}

export function receiptEditorTime(time: unknown): string {
  if (typeof time !== 'string') return ''
  const clock = time.trim()
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : ''
}
export function receiptEditorWall(date: unknown, time: unknown): string {
  const calendar = receiptEditorDate(date), clock = receiptEditorTime(time)
  return calendar && clock ? `${calendar}T${clock}` : ''
}

const ilsNotation = new Set(['₪', 'שח', 'ש"ח', 'ש״ח', 'ש”ח', 'ש“ח', "ש'ח", 'ש׳ח'])
export function receiptEditorCurrency(value: unknown): (typeof reviewCurrencies)[number] | '' {
  if (typeof value !== 'string') return ''
  const printed = value.trim()
  return reviewCurrencies.find(currency => currency === printed) ?? (ilsNotation.has(printed) ? 'ILS' : '')
}
