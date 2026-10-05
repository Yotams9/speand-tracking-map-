import { validateBarcode, type BarcodeIdentity } from './barcode-domain'
import {
  blankReview, lineMinorTotal, minorAmount, reviewCurrencies, validateReview,
  type PurchaseReviewInput, type ReviewContext, type ReviewErrors, type ReviewLine,
} from './session-purchase-domain'

// Plain observed strings are never repaired. Null means missing; candidates
// retain ambiguous observations without choosing an answer for the user.
export type ReceiptObservation = string | null | { candidates: string[] }
export interface ReceiptLineObservation {
  name: ReceiptObservation
  quantity: ReceiptObservation
  unit: ReceiptObservation
  unitPrice: ReceiptObservation
  lineAmount: ReceiptObservation
  // Absence means no printed discount. A supplied null is unresolved, not zero.
  discount?: ReceiptObservation
  barcode?: { original: ReceiptObservation; format: ReceiptObservation } | null
}
export interface ReceiptObservations {
  merchantName: ReceiptObservation
  address: ReceiptObservation
  date: ReceiptObservation
  time: ReceiptObservation
  currency: ReceiptObservation
  finalAmount: ReceiptObservation
  lines: ReceiptLineObservation[]
  preVat?: ReceiptObservation
  vatAmount?: ReceiptObservation
  vatRate?: ReceiptObservation
}
export interface ReceiptReviewLine extends Omit<ReviewLine, 'unit' | 'demoProductId' | 'originalLabel'> {
  unit: '' | ReviewLine['unit']
  printedAmount: string
}
export interface ReceiptReviewDraft {
  // Separate from editable fields; contains no media or provider payload.
  observations: ReceiptObservations
  barcodes: (BarcodeIdentity | null)[]
  review: Omit<PurchaseReviewInput, 'lines' | 'identification'> & { lines: ReceiptReviewLine[] }
}

const headerKeys = ['merchantName', 'address', 'date', 'time', 'currency', 'finalAmount'] as const
const taxKeys = ['preVat', 'vatAmount', 'vatRate'] as const
const lineKeys = ['name', 'quantity', 'unit', 'unitPrice', 'lineAmount'] as const
const own = (value: object, key: string) => Object.hasOwn(value, key)
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}
function keys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]) {
  return Object.keys(value).every(key => allowed.includes(key)) && required.every(key => own(value, key))
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value)
}
// Array iteration skips holes, while structuredClone drops hidden indices.
// Accept only bounded dense data arrays: no inherited entries, extra keys,
// symbols or accessors may bypass validation or enter the observation copy.
function denseArray(value: unknown, maximum: number, minimum = 0): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < minimum || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) return false
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) return false
  }
  return true
}
function observation(value: unknown): value is ReceiptObservation {
  return value === null || text(value) || (object(value) && keys(value, ['candidates'], ['candidates']) &&
    denseArray(value.candidates, 5, 2) && value.candidates.every(text))
}
function barcode(value: unknown): boolean {
  return value === null || (object(value) && keys(value, ['original', 'format'], ['original', 'format']) &&
    observation(value.original) && observation(value.format) &&
    (typeof value.original !== 'string' || typeof value.format !== 'string' || validateBarcode(value.original, value.format).valid))
}

// Structural validation precedes drafting. Semantic financial/date errors stay
// visible in the draft rather than being coerced into plausible facts.
export function validateReceiptObservations(raw: unknown): raw is ReceiptObservations {
  return object(raw) && keys(raw, [...headerKeys, ...taxKeys, 'lines'], [...headerKeys, 'lines']) &&
    headerKeys.every(key => observation(raw[key])) && taxKeys.every(key => !own(raw, key) || observation(raw[key])) &&
    denseArray(raw.lines, 50) && raw.lines.every(line => object(line) &&
      keys(line, [...lineKeys, 'discount', 'barcode'], lineKeys) && lineKeys.every(key => observation(line[key])) &&
      (!own(line, 'discount') || observation(line.discount)) && (!own(line, 'barcode') || barcode(line.barcode)))
}

const observed = (value: ReceiptObservation): string => typeof value === 'string' ? value : ''

export function receiptToReviewDraft(raw: unknown): ReceiptReviewDraft {
  if (!validateReceiptObservations(raw)) throw new Error('receipt-observations-invalid')
  const observations = structuredClone(raw)
  const currency = observed(observations.currency)
  return {
    observations,
    barcodes: observations.lines.map(line => {
      if (!line.barcode || typeof line.barcode.original !== 'string' || typeof line.barcode.format !== 'string') return null
      const result = validateBarcode(line.barcode.original, line.barcode.format)
      return result.valid ? result.identity : null
    }),
    review: {
      ...blankReview(), source: 'receipt', provenance: 'user-reviewed',
      // Printed wall-clock date/time is preserved above. The existing save
      // model expects UTC minutes; no timezone or missing time is inferred.
      date: '', currency: reviewCurrencies.find(value => value === currency) ?? '',
      amount: observed(observations.finalAmount),
      lines: observations.lines.map(line => {
        const unit = observed(line.unit)
        return {
          name: observed(line.name), quantity: observed(line.quantity),
          unit: unit === 'item' || unit === 'kg' ? unit : '',
          price: observed(line.unitPrice), printedAmount: observed(line.lineAmount),
          ...(own(line, 'discount') ? { discount: observed(line.discount!) } : {}),
        }
      }),
    },
  }
}

export type ReceiptReviewPreparation = { ready: false; errors: ReviewErrors }
  | { ready: true; input: PurchaseReviewInput }

// Compatibility check/projection only. Never saves or changes a ledger. Future
// UI wiring must keep printed amounts editable and use this gate before the
// existing explicit save boundary; validateReview alone cannot check them.
export function prepareReceiptReview(draft: ReceiptReviewDraft, context: ReviewContext): ReceiptReviewPreparation {
  const review = draft?.review
  if (!object(review) || !denseArray(review.lines, 50) || review.lines.some(line =>
    !object(line) || !['name', 'quantity', 'price', 'printedAmount', 'unit'].every(key => typeof line[key] === 'string') ||
    (own(line, 'discount') && typeof line.discount !== 'string'))) return { ready: false, errors: { lines: 'items' } }
  const input: PurchaseReviewInput = {
    source: 'receipt', provenance: 'user-reviewed',
    ...(review.directoryIntent !== undefined ? { directoryIntent: review.directoryIntent } : {}),
    merchantId: review.merchantId, placeId: review.placeId, channel: review.channel,
    date: review.date, currency: review.currency, payment: review.payment, category: review.category,
    amount: review.amount, baseAmount: review.baseAmount,
    lines: review.lines.map(line => ({
      name: line.name, quantity: line.quantity, unit: line.unit as ReviewLine['unit'], price: line.price,
      ...(own(line, 'discount') ? { discount: line.discount } : {}),
    })),
  }
  const errors = validateReview(input, context)
  review.lines.forEach((line, index) => {
    if (line.unit !== 'item' && line.unit !== 'kg') errors[`unit-${index}`] = 'required'
    const printed = minorAmount(line.printedAmount, input.currency, true)
    const calculated = lineMinorTotal(input.lines[index], input.currency)
    if (printed === null) errors[`printedAmount-${index}`] = 'amount'
    else if (calculated !== null && printed !== calculated) errors[`printedAmount-${index}`] = 'arithmetic'
  })
  return Object.keys(errors).length ? { ready: false, errors } : { ready: true, input }
}
