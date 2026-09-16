import { type CurrencyCode, type GlobePurchase, type Merchant, type Place, type PurchaseItem, type PaymentMode, type PurchaseCategory } from '../../data/spendscape-globe'
import { createSessionCaptureRecord, type CaptureDraft, type SessionCaptureRecord } from './capture-domain'
import { validateBarcode, type BarcodeIdentity } from './barcode-domain'

export const reviewCurrencies: CurrencyCode[] = ['ILS', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'MXN', 'ZAR']
export const reviewCategories: PurchaseCategory[] = ['groceries', 'food', 'retail', 'travel']
export interface ReviewLine { name: string; quantity: string; unit: 'item' | 'kg'; price: string; originalLabel?: { en: string; he: string } }
export interface PurchaseReviewInput {
  source: CaptureDraft['source']
  provenance: 'synthetic-demo' | 'user-reviewed'
  identification?: { identity: BarcodeIdentity; method: 'camera' | 'manual' | 'demo'; syntheticCatalog: boolean }
  merchantId: string; placeId: string; channel: '' | 'physical' | 'online' | 'unknown'
  date: string; currency: '' | CurrencyCode; payment: '' | PaymentMode; category: '' | PurchaseCategory
  amount: string; baseAmount: string; lines: ReviewLine[]
}
export type ReviewErrors = Record<string, string>
export type ReviewContext = { merchants: readonly Merchant[]; places: readonly Place[] }
// IDs are local idempotency keys, not credentials. A module-lifetime sequence
// survives Capture unmount/reset and needs no secure-context-only browser API.
let operationSequence = 0
export function allocateReviewOperationId(): string {
  return `session_review_${++operationSequence}`
}
export function blankReview(): PurchaseReviewInput {
  return { source: 'manual', provenance: 'user-reviewed', merchantId: '', placeId: '', channel: '', date: '', currency: '', payment: '', category: '', amount: '', baseAmount: '', lines: [] }
}
export function reviewFromDemo(draft: CaptureDraft, locale: 'en' | 'he'): PurchaseReviewInput {
  return { source: draft.source, provenance: 'synthetic-demo', merchantId: draft.merchantId ?? '', placeId: draft.placeId ?? '', channel: draft.channel, date: draft.timestamp.slice(0, 16), currency: draft.originalCurrency, payment: draft.paymentMode, category: draft.category, amount: draft.originalAmount?.toFixed(draft.originalCurrency === 'JPY' ? 0 : 2) ?? '', baseAmount: '', lines: draft.items.map(item => ({ name: item.label[locale], originalLabel: { ...item.label }, quantity: String(item.quantity), unit: item.unit, price: String(item.unitPrice) })) }
}
// Plain decimal input only. No exponents, sign repair, currency inference or float tolerance.
export function minorAmount(value: string, currency: string): number | null {
  if (typeof value !== 'string' || !reviewCurrencies.includes(currency as CurrencyCode)) return null
  const decimals = currency === 'JPY' ? 0 : 2
  if (!(decimals ? /^\d{1,7}(?:\.\d{1,2})?$/ : /^\d{1,7}$/).test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'))
  return result > 0 && Number.isSafeInteger(result) ? result : null
}
function quantityUnits(line: ReviewLine): number | null {
  if (!(line.unit === 'item' ? /^\d{1,4}$/ : line.unit === 'kg' ? /^\d{1,4}(?:\.\d{1,3})?$/ : /a^/).test(line.quantity)) return null
  const value = Math.round(Number(line.quantity) * 1000)
  return value > 0 ? value : null
}
export function lineMinorTotal(line: ReviewLine, currency: string): number | null {
  const quantity = quantityUnits(line), price = minorAmount(line.price, currency)
  if (quantity === null || price === null) return null
  const result = Math.round(price * quantity / 1000)
  return Number.isSafeInteger(result) && result > 0 && result <= 999999999 ? result : null
}
export function validateReview(input: PurchaseReviewInput, context: ReviewContext): ReviewErrors {
  const errors: ReviewErrors = {}
  if (!input || typeof input !== 'object' || ['merchantId', 'placeId', 'date', 'amount', 'baseAmount', 'channel', 'currency', 'payment', 'category', 'source', 'provenance'].some(key => typeof input[key as keyof PurchaseReviewInput] !== 'string')) return { amount: 'required' }
  const amount = minorAmount(input.amount, input.currency)
  if (amount === null) errors.amount = 'amount'
  if (!reviewCurrencies.includes(input.currency as CurrencyCode)) errors.currency = 'required'
  if (!['card', 'cash', 'manual'].includes(input.payment)) errors.payment = 'required'
  if (!reviewCategories.includes(input.category as PurchaseCategory)) errors.category = 'required'
  if (!['physical', 'online', 'unknown'].includes(input.channel)) errors.channel = 'required'
  const date = new Date(input.date + ':00Z')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== input.date || Number(input.date.slice(0, 4)) < 1900 || Number(input.date.slice(0, 4)) > 2100) errors.date = 'date'
  const merchant = context.merchants.find(m => m.id === input.merchantId)
  if (!merchant) errors.merchantId = 'required'
  if (input.channel === 'physical') {
    const place = context.places.find(p => p.id === input.placeId)
    if (!place || !merchant || place.merchantId !== merchant.id || merchant.onlineOnly) errors.placeId = 'place'
  } else if (input.placeId) errors.placeId = 'place'
  if (input.provenance !== 'synthetic-demo' && input.provenance !== 'user-reviewed') errors.provenance = 'required'
  if (!['receipt', 'product', 'barcode', 'document', 'pdf', 'csv', 'manual'].includes(input.source)) errors.source = 'required'
  if (input.provenance === 'user-reviewed' && input.currency !== 'ILS' && minorAmount(input.baseAmount, 'ILS') === null) errors.baseAmount = 'conversion'
  if (!Array.isArray(input.lines) || input.lines.length > 50 || input.lines.some(line => !line || typeof line.name !== 'string' || typeof line.price !== 'string' || typeof line.quantity !== 'string')) errors.lines = 'items'
  else {
    if ((input.source === 'barcode' || input.source === 'product' || input.source === 'receipt') && input.lines.length === 0) errors.lines = 'items'
    input.lines.forEach((line, index) => {
      if (!line.name.trim() || line.name.length > 100 || /[\u0000-\u001f]/.test(line.name)) errors[`name-${index}`] = 'required'
      if (quantityUnits(line) === null) errors[`quantity-${index}`] = 'quantity'
      if (minorAmount(line.price, input.currency) === null) errors[`price-${index}`] = 'amount'
    })
    if (input.lines.length && (input.lines.some(line => lineMinorTotal(line, input.currency) === null) || input.lines.reduce((sum, line) => sum + (lineMinorTotal(line, input.currency) ?? 0), 0) !== amount)) errors.amount = 'arithmetic'
  }
  if (input.identification) {
    if (input.provenance !== 'user-reviewed') errors.provenance = 'required'
    const id = input.identification.identity
    if (!id || typeof id.original !== 'string' || typeof id.format !== 'string') return { ...errors, identification: 'barcode' }
    const checked = validateBarcode(id.original, id.format)
    if (!checked.valid || checked.identity.gtin14 !== id.gtin14 || !['camera', 'manual', 'demo'].includes(input.identification.method)) errors.identification = 'barcode'
  }
  return errors
}
export function reviewedRecord(input: PurchaseReviewInput, sequence: number, context: ReviewContext): SessionCaptureRecord {
  if (Object.keys(validateReview(input, context)).length) throw new Error('review-invalid')
  const factor = input.currency === 'JPY' ? 1 : 100
  const amount = minorAmount(input.amount, input.currency)! / factor
  const items: PurchaseItem[] = input.lines.map((line, index) => ({ id: String(index), label: input.provenance === 'synthetic-demo' && line.originalLabel && [line.originalLabel.en, line.originalLabel.he].includes(line.name) ? { ...line.originalLabel } : { en: line.name.trim(), he: line.name.trim() }, quantity: Number(line.quantity), unit: line.unit, unitPrice: minorAmount(line.price, input.currency)! / factor, lineTotal: lineMinorTotal(line, input.currency)! / factor }))
  const draft: CaptureDraft = { source: input.source, provenance: 'synthetic-demo', merchantId: input.merchantId, placeId: input.placeId || null, timestamp: input.date + ':00.000Z', channel: input.channel as CaptureDraft['channel'], resolution: input.channel === 'unknown' ? 'unresolved' : 'confirmed', paymentMode: input.payment as PaymentMode, category: input.category as PurchaseCategory, originalAmount: amount, originalCurrency: input.currency as CurrencyCode, items, productCandidateOnly: false, contextConfirmed: true }
  const record = createSessionCaptureRecord(draft, sequence)
  if (input.provenance === 'user-reviewed') {
    const base = input.currency === 'ILS' ? amount : minorAmount(input.baseAmount, 'ILS')! / 100
    record.purchase.fx = { baseCurrency: 'ILS', rateToBase: base / amount, effectiveAt: draft.timestamp, source: input.currency === 'ILS' ? 'identity' : 'user-reported-conversion', reportedBaseAmountIls: base, label: input.currency === 'ILS' ? { en: 'ILS · no conversion', he: 'ש״ח · ללא המרה' } : { en: 'ILS amount reported by you · not verified FX', he: 'סכום בש״ח שדווח על ידך · לא שער מאומת' } }
    record.purchase.provenance = 'user-reviewed-session'
    record.synthetic = false
    record.evidence.synthetic = false
    record.evidence.kind = 'manual-entry'
    record.evidence.label = { en: 'Purchase details reviewed by you · session only', he: 'פרטי רכישה שנבדקו על ידך · להפעלה בלבד' }
  }
  if (input.identification) record.identification = { method: input.identification.method, syntheticCatalog: input.identification.syntheticCatalog === true, identity: { original: input.identification.identity.original, format: input.identification.identity.format, gtin14: input.identification.identity.gtin14 } }
  return record
}
export interface SessionPurchaseLedger { records: readonly SessionCaptureRecord[]; consumed: readonly string[]; nextSequence: number; undoId: string | null }
export const emptySessionLedger = (): SessionPurchaseLedger => ({ records: [], consumed: [], nextSequence: 1, undoId: null })
function fingerprint(p: GlobePurchase) {
  return JSON.stringify([p.merchantId, p.placeId, p.channel, p.timestamp, p.originalCurrency, p.originalAmount, p.paymentMode, p.category, p.items.map(i => [i.label.en, i.quantity, i.unit, i.unitPrice, i.lineTotal])])
}
export type SaveReviewResult = { code: 'saved'; purchaseId: string } | { code: 'invalid'; errors: ReviewErrors } | { code: 'duplicate' | 'consumed' }
export function saveReviewedPurchase(ledger: SessionPurchaseLedger, operationId: string, input: PurchaseReviewInput, context: ReviewContext, baseline: readonly GlobePurchase[], allowDuplicate = false): { ledger: SessionPurchaseLedger; result: SaveReviewResult } {
  if (!operationId || ledger.consumed.includes(operationId)) return { ledger, result: { code: 'consumed' } }
  const errors = validateReview(input, context)
  if (Object.keys(errors).length) return { ledger, result: { code: 'invalid', errors } }
  const record = reviewedRecord(input, ledger.nextSequence, context)
  if (!allowDuplicate && [...baseline, ...ledger.records.map(r => r.purchase)].some(p => fingerprint(p) === fingerprint(record.purchase))) return { ledger, result: { code: 'duplicate' } }
  return { ledger: { records: [...ledger.records, record], consumed: [...ledger.consumed, operationId], nextSequence: ledger.nextSequence + 1, undoId: record.purchase.id }, result: { code: 'saved', purchaseId: record.purchase.id } }
}
export function undoSessionPurchase(ledger: SessionPurchaseLedger): SessionPurchaseLedger {
  return { ...ledger, records: ledger.records.filter(r => r.purchase.id !== ledger.undoId), undoId: null }
}
export function resetSessionPurchases(ledger: SessionPurchaseLedger): SessionPurchaseLedger { return { ...ledger, records: [], undoId: null } }
