import { label, numeric, rows, unique, validateOcrDocument, parseOcrReceipt, type OcrWord } from './ocr-parser'
import type { ReceiptObservations, ReceiptLineObservation } from '../capture/receipt-review-adapter'
import { ReceiptLayoutError } from './layout-reason'
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
  try { return parseOcrReceipt(raw) } catch (error) { if (!(error instanceof ReceiptLayoutError) || error.reason !== 'table-header-missing') throw error }
  // Modest baseline offsets are bounded against the first word, never chained.
  const grouped = rows(raw.words, .65)
  const tables = grouped.map((row, i) => ({ i, row, name: spans(row, ['תיאורפריט','Itemdescription']), amount: spans(row, ['סהכ','Amount']), code: spans(row,['קודפריט','Itemcode']) })).filter(t => t.name.length > 0 && t.amount.length > 0 && t.code.length > 0)
  if (tables.length !== 1) throw new ReceiptLayoutError(tables.length ? 'table-header-ambiguous' : 'table-header-missing')
  const table = tables[0], second = grouped[table.i + 1] ?? []
  if(table.name.length!==1 || table.amount.length!==1 || table.code.length!==1)throw new ReceiptLayoutError('column-header-ambiguous')
  const headerNear = second.length && second[0].y - table.row[0].y <= Math.max(...table.row.map(w=>w.height)) * 4
  const quantities = headerNear ? spans(second, ['כמות','Quantity']) : [], prices = headerNear ? spans(second, ['מיחידה','מחיריחידה','Unitprice']) : []
  const numericHeader = quantities.length > 0 || prices.length > 0
  const quantity = quantities.length === 1 ? quantities[0] : null, price = prices.length === 1 ? prices[0] : null
  const amount = table.amount[0], name = table.name[0], code = table.code[0]
  if (!(center(amount) < center(name) && center(name) < center(code))) throw new ReceiptLayoutError('column-order-unsupported')
  const numericColumns = quantity && price && center(price) < center(quantity)
  const bodyStart = table.i + (numericHeader ? 2 : 1)
  const summary = grouped.map((row, i) => ({ row, i, total: spans(row, ['סכוםכוללמעמ','לתשלום','Totalpayable']), tax: spans(row,['סכוםלפנימעמ','מעמ','VAT']) })).filter(r => r.i >= bodyStart && (r.total.length || r.tax.length))
  const footer = summary[0]?.i ?? grouped.length, body = grouped.slice(bodyStart, footer)
  if (!body.length || body.length > 200) throw new ReceiptLayoutError(body.length ? 'item-count-limit' : 'item-anchor-missing')
  const amountRight = (center(amount) + center(name)) / 2, nameRight = (center(name) + center(code)) / 2
  const numberMiddle = numericColumns ? (center(price!) + center(quantity!)) / 2 : null
  const within = (w: OcrWord, left: number, right: number) => w.x >= left && w.x + w.width <= right
  const numericFragment = (text: string) => /^[0-9O.,%+-]+$/.test(text) || /^[0-9A-Za-z.,%+-]+$/.test(text) && /[0-9]/.test(text) && /[.,]/.test(text)
  const lines: ReceiptLineObservation[] = []
  const isStart = (row: OcrWord[]) => {
    const amountWords=row.filter(w=>within(w,0,amountRight)), codeWords=row.filter(w=>within(w,nameRight,raw.width)), nameWords=row.filter(w=>within(w,amountRight,nameRight))
    const description=nameWords.some(w=>/[A-Za-z\u0590-\u05ff]/.test(w.text) && !numericFragment(w.text))
    const identifier=codeWords.length===1 && /^[0-9]{5,}$/.test(codeWords[0].text)
    return description && (amountWords.length>0 || identifier) || amountWords.length>0 && identifier
  }
  const starts=body.flatMap((row,i)=>isStart(row)?[i]:[])
  if (!starts.length) throw new ReceiptLayoutError('item-anchor-missing')
  if (starts[0] !== 0) throw new ReceiptLayoutError('item-row-unassigned')
  for (let item = 0; item < starts.length; item++) {
    const top = body[starts[item]], following=body.slice(starts[item]+1,starts[item+1]??body.length)
    const nameRows=[top.filter(w=>within(w,amountRight,nameRight))]
    const numericRows: OcrWord[][]=[]
    for(const row of following){
      const near=row[0].y-top[0].y <= Math.max(...top.map(w=>w.height))*8
      const description=row.every(w=>within(w,amountRight,nameRight)) && row.some(w=>/[A-Za-z\u0590-\u05ff]/.test(w.text)) && !row.every(w=>numericFragment(w.text))
      if(description && near)nameRows.push(row)
      // Retain malformed numeric observations verbatim; a short quantity beside
      // a damaged price is not a product-code anchor or a new item.
      else if(row.every(w=>numericFragment(w.text)) && row.every(w=>w.x>=amountRight)){if(near)numericRows.push(row)}
      else throw new ReceiptLayoutError('item-row-unassigned')
    }
    const names=nameRows.map(row=>label(row)), itemName=names.every(v=>v!==null)?names.join(' '):null
    const amounts = top.filter(w => within(w, 0, amountRight))
    const bottom=numericRows.length===1?numericRows[0]:[]
    const nums = bottom.filter(w => !w.text.includes('%'))
    // Discount percentages cannot become explicit amount discounts. Additional
    // printed numbers in a numeric field make it unresolved, never arithmetic.
    const field = (row: OcrWord[], left: number, right: number, kind: string) => {
      const intersecting = row.filter(w => w.x < right && w.x + w.width > left)
      return intersecting.some(w => !within(w,left,right)) ? null : numeric(intersecting,kind)
    }
    const p = numberMiddle === null ? null : field(nums, amountRight, numberMiddle, 'unitPrice')
    const q = numberMiddle === null ? null : field(nums, numberMiddle, raw.width, 'quantity')
    // Ambiguous row association must not erase a printed discount marker.
    const discountUnresolved = numericRows.some(row=>row.some(w=>w.text.includes('%')))
    const amountCrossing=top.some(w=>w.x<amountRight && w.x+w.width>amountRight)
    lines.push({ name: itemName && itemName.length<=500?itemName:null, quantity: q, unit: null, unitPrice: p, lineAmount: amountCrossing?null:numeric(amounts, 'lineAmount'), ...(discountUnresolved ? {discount:null} : {}) })
  }
  if (!lines.length || lines.length > 50) throw new ReceiptLayoutError(lines.length ? 'item-count-limit' : 'item-anchor-missing')
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
