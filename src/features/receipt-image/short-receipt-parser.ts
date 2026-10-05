import { label, numeric, rows, unique, validateOcrDocument, parseOcrReceipt, type OcrWord } from './ocr-parser'
import type { ReceiptObservations, ReceiptLineObservation } from '../capture/receipt-review-adapter'
const center = (w: OcrWord) => w.x + w.width / 2
const compact = (v: string) => v.replace(/[\s"״׳'.:]/g, '')
const phrase = (row: OcrWord[]) => compact(label(row) ?? '')
const isDate = (v: string) => /^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-](?:\d{2}|\d{4}))$/.test(v)
function spans(row: OcrWord[], choices: string[]) {
  const out: OcrWord[] = []
  for (let i = 0; i < row.length; i++) for (let size = 1; size <= 4 && i + size <= row.length; size++) {
    const words = row.slice(i, i + size)
    if (!choices.includes(phrase(words))) continue
    const x = Math.min(...words.map(w => w.x)), right = Math.max(...words.map(w => w.x + w.width))
    out.push({ text: label(words)!, x, y: words[0].y, width: right - x, height: words[0].height })
  }
  return out
}
// A narrowly supported short printed layout: top merchant/address lines, one
// two-row description/code/amount + quantity/unit-price table, labelled totals.
// Anchors come from text/relative geometry; never crop coordinates or reference
// answers. Unsupported currency/units, percent discounts and dates stay raw.
export function parseVisionReceipt(raw: unknown) {
  if (!validateOcrDocument(raw)) throw new Error('ocr-invalid')
  try { return parseOcrReceipt(raw) } catch (error) { if (!(error instanceof Error) || error.message !== 'layout-unsupported') throw error }
  const grouped = rows(raw.words)
  const tables = grouped.map((row, i) => ({ i, row, name: spans(row, ['תיאורפריט','Itemdescription']), amount: spans(row, ['סהכ','Amount']), code: spans(row,['קודפריט','Itemcode']) })).filter(t => t.name.length === 1 && t.amount.length === 1 && t.code.length === 1)
  if (tables.length !== 1) throw new Error('layout-unsupported')
  const table = tables[0], second = grouped[table.i + 1]
  if (!second) throw new Error('layout-unsupported')
  const quantities = spans(second, ['כמות','Quantity']), prices = spans(second, ['מיחידה','מחיריחידה','Unitprice'])
  if (quantities.length !== 1 || prices.length !== 1) throw new Error('layout-unsupported')
  const quantity = quantities[0], price = prices[0], amount = table.amount[0], name = table.name[0], code = table.code[0]
  if (!(center(amount) < center(name) && center(name) < center(code) && center(price) < center(quantity))) throw new Error('layout-unsupported')
  const summary = grouped.map((row, i) => ({ row, i, total: spans(row, ['סכוםכוללמעמ','לתשלום','Totalpayable']), tax: spans(row,['סכוםלפנימעמ','מעמ','VAT']) })).filter(r => r.i > table.i + 1 && (r.total.length || r.tax.length))
  if (!summary.length) throw new Error('layout-unsupported')
  const footer = summary[0].i, body = grouped.slice(table.i + 2, footer)
  if (!body.length || body.length > 100) throw new Error('layout-unsupported')
  const amountRight = (center(amount) + center(name)) / 2, nameRight = (center(name) + center(code)) / 2, numberMiddle = (center(price) + center(quantity)) / 2
  const within = (w: OcrWord, left: number, right: number) => w.x >= left && w.x + w.width <= right
  const lines: ReceiptLineObservation[] = []
  for (let i = 0; i < body.length; i += 2) {
    const top = body[i], bottom = body[i + 1]
    if (!bottom || Math.abs(bottom[0].y - top[0].y) > Math.max(...top.map(w => w.height)) * 3) throw new Error('layout-unsupported')
    const nameWords = top.filter(w => within(w, amountRight, nameRight))
    const amounts = top.filter(w => within(w, 0, amountRight))
    const nums = bottom.filter(w => !w.text.includes('%'))
    // Discount percentages cannot become explicit amount discounts. Additional
    // printed numbers in a numeric field make it unresolved, never arithmetic.
    const field = (row: OcrWord[], left: number, right: number, kind: string) => {
      const intersecting = row.filter(w => w.x < right && w.x + w.width > left)
      return intersecting.some(w => !within(w,left,right)) ? null : numeric(intersecting,kind)
    }
    const p = field(nums, amountRight, numberMiddle, 'unitPrice')
    const q = field(nums, numberMiddle, raw.width, 'quantity')
    const unsupported = bottom.filter(w => !nums.includes(w))
    lines.push({ name: label(nameWords), quantity: q, unit: null, unitPrice: p, lineAmount: numeric(amounts, 'lineAmount'), ...(unsupported.some(w => w.text.includes('%')) ? {discount:null} : {}) })
  }
  if (!lines.length || lines.length > 50) throw new Error('layout-unsupported')
  const before = grouped.slice(0,table.i)
  const dates: (string|null)[] = [], times: (string|null)[] = []
  for (const row of before) for (const w of row) { if (isDate(w.text)) dates.push(w.text); if (/^\d{2}:\d{2}$/.test(w.text)) times.push(w.text) }
  // Merchant/address inference is limited to the two first printed text rows.
  // An identifier, phone, receipt heading or date cannot become a merchant.
  const heading = (row: OcrWord[] | undefined) => row &&
    !row.some(w => isDate(w.text) || /\d{5,}|\d{2}:\d{2}|חשבונית|קבלה|Invoice|Receipt/.test(w.text)) &&
    !isDate(row.map(w => w.text).join('')) &&
    !row.every(w => /^[\d\s./:-]+$/.test(w.text)) ? label(row) : null
  const totals = summary.filter(r=>r.total.length).map(r => {
    if (r.total.length !== 1) return null
    const anchor = r.total[0]
    // Select by geometry before parsing. Dropping malformed/incomplete tokens
    // could turn an observed decimal fragment into a different financial fact.
    if (r.row.some(w => w.x < anchor.x + anchor.width && w.x + w.width > anchor.x && !within(w, anchor.x, anchor.x + anchor.width))) return null
    const values = r.row.filter(w=>w.x+w.width <= anchor.x || w.x >= anchor.x+anchor.width)
    return numeric(values,'finalAmount')
  })
  // Only an explicit header field establishes currency in this layout.
  // Product names/internal codes and unlabelled tokens cannot establish it.
  const currencies = before.flatMap(row => {
    const keys = row.filter(w => ['Currency:', 'מטבע:'].includes(w.text))
    if (!keys.length) return []
    if (keys.length !== 1 || keys[0] !== row[0] && keys[0] !== row.at(-1)) return [null]
    const value = label(row.filter(w => w !== keys[0]))
    return [value && ['ILS','USD','EUR','GBP','₪'].includes(value) ? value : null]
  })
  const observations: ReceiptObservations = { merchantName:heading(before[0]),address:heading(before[1]),date:unique(dates),time:unique(times),currency:unique(currencies),finalAmount:unique(totals),lines }
  return {observations,diagnostics:{layout:'short-printed-table' as const,rows:lines.length,unresolved: Object.values(observations).filter(v=>v===null).length+lines.reduce((n,l)=>n+Object.values(l).filter(v=>v===null).length,0)}}
}
