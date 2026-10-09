import type { PurchaseReviewInput, ReviewLine } from '../capture/session-purchase-domain'

// Receipt R1. The model only transcribes what is printed; every number below is
// checked by code in integer agorot. Nothing is corrected silently.
export interface ReceiptLine {
  name: string
  barcode?: string
  quantity: number
  unit: 'item' | 'kg'
  unitPrice: number
  lineTotal: number
}
export interface ReceiptDiscount { label: string; amount: number }
export interface ReceiptExtraction {
  storeName: string
  chain?: string
  branchName?: string
  purchasedAt?: string
  currency: string
  lines: ReceiptLine[]
  discounts: ReceiptDiscount[]
  total: number
}

export type ReceiptIssueCode =
  | 'invalid-number'
  | 'non-positive'
  | 'fractional-item-quantity'
  | 'line-arithmetic'
  | 'discount-sign'
  | 'empty-name'
  | 'no-lines'
  | 'total-mismatch'
export interface ReceiptIssue { code: ReceiptIssueCode; message: string; expected?: number; actual?: number }
export interface ReceiptValidation {
  ok: boolean
  lineIssues: Record<number, ReceiptIssue[]>
  discountIssues: Record<number, ReceiptIssue[]>
  totalIssues: ReceiptIssue[]
  issues: ReceiptIssue[]
  /** All amounts in agorot (integers); null where the printed value was not a finite number. */
  sums: { lines: number; discounts: number; expectedTotal: number; printedTotal: number | null }
}

export const toAgorot = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null

export const LINE_TOLERANCE_AGOROT = { item: 1, kg: 2 } as const

function push(map: Record<number, ReceiptIssue[]>, index: number, issue: ReceiptIssue, all: ReceiptIssue[]) {
  ;(map[index] ??= []).push(issue)
  all.push(issue)
}

export function validateReceipt(receipt: ReceiptExtraction): ReceiptValidation {
  const lineIssues: Record<number, ReceiptIssue[]> = {}
  const discountIssues: Record<number, ReceiptIssue[]> = {}
  const totalIssues: ReceiptIssue[] = []
  const issues: ReceiptIssue[] = []
  let linesSum = 0
  let discountsSum = 0

  if (!Array.isArray(receipt.lines) || receipt.lines.length === 0) {
    const issue: ReceiptIssue = { code: 'no-lines', message: 'No lines were read from the receipt.' }
    totalIssues.push(issue)
    issues.push(issue)
  }

  ;(receipt.lines ?? []).forEach((line, index) => {
    const unitPrice = toAgorot(line.unitPrice)
    const lineTotal = toAgorot(line.lineTotal)
    const quantity = typeof line.quantity === 'number' && Number.isFinite(line.quantity) ? line.quantity : null
    if (!line.name || !line.name.trim()) push(lineIssues, index, { code: 'empty-name', message: 'Line has no name.' }, issues)
    if (unitPrice === null || lineTotal === null || quantity === null) {
      push(lineIssues, index, { code: 'invalid-number', message: 'Quantity, unit price or line total is not a number.' }, issues)
      return
    }
    if (quantity <= 0 || unitPrice <= 0 || lineTotal <= 0) {
      push(lineIssues, index, { code: 'non-positive', message: 'Quantity, unit price and line total must be positive; returns are not handled in R1.' }, issues)
    }
    if (line.unit === 'item' && !Number.isInteger(quantity)) {
      push(lineIssues, index, { code: 'fractional-item-quantity', message: 'An item line has a fractional quantity.', actual: quantity }, issues)
    }
    const expected = Math.round(quantity * unitPrice)
    const tolerance = LINE_TOLERANCE_AGOROT[line.unit === 'kg' ? 'kg' : 'item']
    if (Math.abs(expected - lineTotal) > tolerance) {
      push(lineIssues, index, { code: 'line-arithmetic', message: 'quantity × unit price does not match the printed line total.', expected, actual: lineTotal }, issues)
    }
    linesSum += lineTotal
  })

  ;(receipt.discounts ?? []).forEach((discount, index) => {
    const amount = toAgorot(discount.amount)
    if (amount === null) {
      push(discountIssues, index, { code: 'invalid-number', message: 'Discount amount is not a number.' }, issues)
      return
    }
    if (amount >= 0) push(discountIssues, index, { code: 'discount-sign', message: 'Discount amounts must be negative as printed.', actual: amount }, issues)
    discountsSum += amount
  })

  const printedTotal = toAgorot(receipt.total)
  const expectedTotal = linesSum + discountsSum
  if (printedTotal === null || printedTotal <= 0) {
    const issue: ReceiptIssue = { code: 'invalid-number', message: 'Receipt total is missing or not positive.' }
    totalIssues.push(issue)
    issues.push(issue)
  } else if (printedTotal !== expectedTotal) {
    const issue: ReceiptIssue = { code: 'total-mismatch', message: 'Sum of lines plus discounts does not equal the printed total.', expected: expectedTotal, actual: printedTotal }
    totalIssues.push(issue)
    issues.push(issue)
  }

  return { ok: issues.length === 0, lineIssues, discountIssues, totalIssues, issues, sums: { lines: linesSum, discounts: discountsSum, expectedTotal, printedTotal } }
}

const decimal = (agorot: number) => (agorot / 100).toFixed(2)

export interface ReceiptReviewMapping {
  input: PurchaseReviewInput
  /** Things the user must resolve in review; never auto-fixed. */
  notes: string[]
}

/**
 * Maps an extraction into the existing review shape. Merchant, place, payment
 * and category stay empty: the receipt text is evidence, not a match. Discounts
 * have no line in the review shape, so a receipt with discounts surfaces the
 * review's own arithmetic error instead of being folded in silently.
 */
export function receiptToReviewInput(receipt: ReceiptExtraction): ReceiptReviewMapping {
  const notes: string[] = []
  const currency = receipt.currency === 'ILS' ? 'ILS' : ''
  if (!currency) notes.push('currency-unconfirmed')
  const lines: ReviewLine[] = receipt.lines.map(line => ({
    name: line.name.trim().slice(0, 100),
    quantity: String(line.quantity),
    unit: line.unit,
    price: decimal(toAgorot(line.unitPrice) ?? 0),
  }))
  if (receipt.discounts.length > 0) notes.push('discounts-not-representable')
  const date = receipt.purchasedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(receipt.purchasedAt) ? receipt.purchasedAt.slice(0, 16) : ''
  if (!date) notes.push('date-missing')
  const total = toAgorot(receipt.total)
  return {
    input: {
      source: 'receipt',
      provenance: 'user-reviewed',
      merchantId: '',
      placeId: '',
      channel: '',
      date,
      currency,
      payment: '',
      category: '',
      amount: total !== null && total > 0 ? decimal(total) : '',
      baseAmount: '',
      lines,
    },
    notes,
  }
}
