import type { ReceiptObservations, ReceiptObservation, ReceiptLineObservation } from '../capture/receipt-review-adapter'

export interface OcrWord { text: string; x: number; y: number; width: number; height: number }
export interface OcrDocument { version: 1; width: number; height: number; words: OcrWord[] }
const fields = ['name', 'quantity', 'unit', 'unitPrice', 'discount', 'lineAmount'] as const
type Column = typeof fields[number]
const columns: Record<string, Column> = Object.assign(Object.create(null), { Item: 'name', פריט: 'name', Qty: 'quantity', כמות: 'quantity', Unit: 'unit', יחידה: 'unit', Price: 'unitPrice', מחיר: 'unitPrice', Discount: 'discount', הנחה: 'discount', Amount: 'lineAmount', סכום: 'lineAmount' })
const headers: Record<string, keyof Omit<ReceiptObservations, 'lines'>> = Object.assign(Object.create(null), { Merchant: 'merchantName', 'בית עסק': 'merchantName', Address: 'address', כתובת: 'address', Date: 'date', תאריך: 'date', Time: 'time', שעה: 'time', Currency: 'currency', מטבע: 'currency', Total: 'finalAmount', לתשלום: 'finalAmount', 'סה״כ': 'finalAmount', 'Pre-VAT': 'preVat', VAT: 'vatAmount', 'VAT-rate': 'vatRate' })
function plain(raw: unknown, keys: string[]): raw is Record<string, unknown> {
  return !!raw && typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype && Reflect.ownKeys(raw).length === keys.length && keys.every(k => { const d = Object.getOwnPropertyDescriptor(raw, k); return d?.enumerable && Object.hasOwn(d, 'value') })
}
export function validateOcrDocument(raw: unknown): raw is OcrDocument {
  if (!plain(raw, ['version', 'width', 'height', 'words']) || raw.version !== 1 || !Number.isInteger(raw.width) || !Number.isInteger(raw.height) || (raw.width as number) < 1 || (raw.height as number) < 1 || (raw.width as number) > 6000 || (raw.height as number) > 6000 || !Array.isArray(raw.words) || Object.getPrototypeOf(raw.words) !== Array.prototype || raw.words.length > 1500 || Reflect.ownKeys(raw.words).length !== raw.words.length + 1) return false
  for (let i = 0; i < raw.words.length; i++) {
    const d = Object.getOwnPropertyDescriptor(raw.words, String(i))
    if (!d?.enumerable || !Object.hasOwn(d, 'value')) return false
    const w = d.value
    if (!plain(w, ['text', 'x', 'y', 'width', 'height']) || typeof w.text !== 'string' || !w.text.length || w.text.length > 100 || /[\u0000-\u001f\u007f]/.test(w.text) || !['x', 'y', 'width', 'height'].every(k => typeof w[k] === 'number' && Number.isFinite(w[k])) || (w.x as number) < 0 || (w.y as number) < 0 || (w.width as number) <= 0 || (w.height as number) <= 0 || (w.x as number) + (w.width as number) > (raw.width as number) || (w.y as number) + (w.height as number) > (raw.height as number)) return false
  }
  return true
}
const center = (w: OcrWord) => w.x + w.width / 2
export function rows(words: OcrWord[]): OcrWord[][] {
  const result: OcrWord[][] = []
  for (const word of [...words].sort((a, b) => a.y + a.height / 2 - b.y - b.height / 2 || a.x - b.x)) {
    const last = result.at(-1), anchor = last?.[0]
    if (anchor && Math.abs(word.y + word.height / 2 - anchor.y - anchor.height / 2) <= Math.min(word.height, anchor.height) * .45) last!.push(word)
    else result.push([word])
  }
  return result.map(row => row.sort((a, b) => a.x - b.x))
}
export function label(words: OcrWord[]): string | null {
  if (!words.length) return null
  const visual = [...words].sort((a, b) => a.x - b.x)
  if (visual.some((word, i) => i > 0 && word.x < visual[i - 1].x + visual[i - 1].width)) return null
  // Content runs, never the table/header language, determine reading order.
  // Keep each observed word intact and Latin runs LTR inside a Hebrew label.
  const rtl = words.some(word => /[\u0590-\u05ff]/.test(word.text))
  const ordered = [...words].sort((a, b) => rtl ? b.x - a.x : a.x - b.x)
  // Within an RTL field, contiguous Latin runs retain their visual LTR order.
  if (rtl) for (let i = 0; i < ordered.length;) {
    if (/[\u0590-\u05ff]/.test(ordered[i].text)) { i++; continue }
    let end = i + 1
    while (end < ordered.length && !/[\u0590-\u05ff]/.test(ordered[end].text)) end++
    ordered.splice(i, end - i, ...ordered.slice(i, end).reverse()); i = end
  }
  const value = ordered.map(w => w.text).join(' ')
  return value.length <= 500 ? value : null
}
export function numeric(words: OcrWord[], kind: string): string | null {
  if (!words.length || words.length > 7) return null
  const ordered = [...words].sort((a, b) => a.x - b.x)
  if (ordered.length === 1) return ordered[0].text
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1], b = ordered[i], gap = b.x - a.x - a.width
    if (gap < -1 || gap > Math.min(a.height, b.height) * .65) return null
  }
  const value = ordered.map(w => w.text).join('')
  // Two complete neighboring integers are ambiguous, not a split quantity.
  // Decimal reconstruction requires a visibly incomplete/standalone dot token.
  if (!['date', 'time', 'vatRate'].includes(kind) && !ordered.some(w => /^(?:\.|\d+\.|\.\d+)$/.test(w.text))) return null
  const pattern = kind === 'date' ? /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/ : kind === 'time' ? /^\d{2}:\d{2}$/ : kind === 'vatRate' ? /^\d{1,3}(?:\.\d{1,2})?%$/ : /^\d{1,8}(?:\.\d{1,3})?$/
  return pattern.test(value) ? value : null
}
export function unique(values: (string | null)[]): ReceiptObservation {
  // An unresolved printed occurrence cannot be masked by a resolved repeat.
  if (values.includes(null)) return null
  const all = [...new Set(values.filter((value): value is string => value !== null))]
  return all.length === 1 ? all[0] : all.length >= 2 && all.length <= 5 ? { candidates: all } : null
}
// Explicit labelled headers and one aligned item table only. No fixed receipt
// regions, expected-answer lookup, totals repair, ID/barcode inference or FX.
export function parseOcrReceipt(raw: unknown): { observations: ReceiptObservations; diagnostics: { layout: 'labelled-table'; rows: number; unresolved: number } } {
  if (!validateOcrDocument(raw)) throw new Error('ocr-invalid')
  const grouped = rows(raw.words)
  const candidates = grouped.map((r, i) => ({ i, r, known: r.filter(w => columns[w.text]) })).filter(r => ['name', 'quantity', 'unit', 'unitPrice', 'lineAmount'].every(k => r.known.filter(w => columns[w.text] === k).length === 1))
  if (candidates.length !== 1) throw new Error('layout-unsupported')
  const table = candidates[0], anchors = table.known.sort((a, b) => center(a) - center(b))
  if (new Set(anchors.map(w => columns[w.text])).size !== anchors.length) throw new Error('layout-unsupported')
  const found: Partial<Record<keyof Omit<ReceiptObservations, 'lines'>, (string | null)[]>> = {}
  const headerRows = new Set<number>()
  grouped.forEach((row, index) => {
    const keyed = row.filter(w => w.text.endsWith(':') && headers[w.text.slice(0, -1)])
    if (keyed.length !== 1 || keyed[0] !== row[0] && keyed[0] !== row.at(-1)) return
    const key = keyed[0], field = headers[key.text.replace(/:$/, '')], rest = row.filter(w => w !== key)
    headerRows.add(index)
    const value = ['merchantName', 'address', 'currency'].includes(field) ? label(rest) : numeric(rest, field)
    ;(found[field] ??= []).push(value)
  })
  const footer = grouped.findIndex((_, i) => i > table.i && headerRows.has(i))
  const itemRows = grouped.slice(table.i + 1, footer < 0 ? grouped.length : footer)
  if (!itemRows.length || itemRows.length > 50) throw new Error('layout-unsupported')
  const lines: ReceiptLineObservation[] = itemRows.map(row => {
    const buckets: Partial<Record<Column, OcrWord[]>> = {}, conflicts = new Set<Column>()
    row.forEach(word => {
      const index = anchors.findIndex((_, i) => center(word) < (i === anchors.length - 1 ? raw.width : (center(anchors[i]) + center(anchors[i + 1])) / 2))
      if (index < 0) return
      const key = columns[anchors[index].text], left = index === 0 ? 0 : (center(anchors[index - 1]) + center(anchors[index])) / 2, right = index === anchors.length - 1 ? raw.width : (center(anchors[index]) + center(anchors[index + 1])) / 2
      if (word.x < left || word.x + word.width > right) conflicts.add(key)
      ;(buckets[key] ??= []).push(word)
    })
    const get = (key: Column) => conflicts.has(key) ? null : key === 'name' || key === 'unit' ? label(buckets[key] ?? []) : numeric(buckets[key] ?? [], key)
    return { name: get('name'), quantity: get('quantity'), unit: get('unit'), unitPrice: get('unitPrice'), lineAmount: get('lineAmount'), ...(anchors.some(w => columns[w.text] === 'discount') ? { discount: get('discount') } : {}) }
  })
  const observations: ReceiptObservations = { merchantName: unique(found.merchantName ?? []), address: unique(found.address ?? []), date: unique(found.date ?? []), time: unique(found.time ?? []), currency: unique(found.currency ?? []), finalAmount: unique(found.finalAmount ?? []), lines }
  for (const key of ['preVat', 'vatAmount', 'vatRate'] as const) if (found[key]) observations[key] = unique(found[key]!)
  const unresolved = lines.reduce((count, line) => count + Object.values(line).filter(v => v === null).length, Object.values(observations).filter(v => v === null || typeof v === 'object' && 'candidates' in v).length)
  return { observations, diagnostics: { layout: 'labelled-table', rows: lines.length, unresolved } }
}
