import { reviewCurrencies } from './session-purchase-domain'

// Explicit college policy: supported DMY years 00–99 mean 2000–2099.
// Originals stay in observations. No rollover, time or timezone inference.
function printedReceiptDate(value: unknown): { date: string; collegeYear: boolean } | null {
  if (typeof value !== 'string') return null
  const printed = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(printed)
  const dmy = /^(\d{2})([/-])(\d{2})\2(\d{4}|\d{2})$/.exec(printed)
  const collegeYear = dmy?.[4].length === 2
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [collegeYear ? `20${dmy[4]}` : dmy[4], dmy[3], dmy[1]] : null
  if (!parts) return null
  const [year, month, day] = parts.map(Number)
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = parts.join('-')
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date ? { date, collegeYear } : null
}
export function receiptEditorDate(value: unknown): string {
  return printedReceiptDate(value)?.date ?? ''
}
export function receiptEditorUsesCollegeYear(value: unknown): boolean {
  return printedReceiptDate(value)?.collegeYear ?? false
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
