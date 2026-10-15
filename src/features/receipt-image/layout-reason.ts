import { validRowRejection, type RowRejection } from './row-rejection'
// Structural metadata only: never embed OCR words, coordinates or values.
export const layoutReasons = ['table-header-missing', 'table-header-ambiguous', 'column-order-unsupported', 'column-header-ambiguous', 'item-anchor-missing', 'item-row-unassigned', 'item-count-limit'] as const
export type LayoutReason = typeof layoutReasons[number]
export class ReceiptLayoutError extends Error {
  constructor(readonly reason: LayoutReason, readonly rowRejection?: RowRejection) { super('layout-unsupported') }
}
export function layoutReason(error: unknown): LayoutReason | undefined {
  return error instanceof ReceiptLayoutError && layoutReasons.includes(error.reason) ? error.reason : undefined
}

export function layoutRowRejection(error:unknown):RowRejection | undefined {
  return error instanceof ReceiptLayoutError && error.reason==='item-row-unassigned' && validRowRejection(error.rowRejection) ? error.rowRejection : undefined
}
