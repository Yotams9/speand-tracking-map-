import type { DirectoryIntent } from '../local-purchases/local-directory'
import type { ReceiptObservations } from './receipt-review-adapter'
import { receiptEditorWall } from './receipt-editor-values'
import { receiptTimeCandidates } from './receipt-review-time'

// Explicitly requested local review defaults, not extracted receipt facts.
// Originals stay in observations; Save remains the user's confirmation.
export const receiptReviewZone = 'Asia/Jerusalem'
export function receiptReviewPrefill<T extends {
  currency: string; date: string; merchantId: string; directoryIntent?: DirectoryIntent
}>(initial: T, observations: ReceiptObservations): T {
  const candidates = receiptTimeCandidates(receiptEditorWall(observations.date, observations.time), receiptReviewZone)
  const name = typeof observations.merchantName === 'string' ? observations.merchantName : ''
  return {
    ...initial,
    // Do not override a known currency or resolve competing/unrecognized text.
    currency: initial.currency || (observations.currency === null ? 'ILS' : ''),
    date: initial.date || (candidates.length === 1 ? candidates[0] : ''),
    ...(!initial.merchantId && !initial.directoryIntent && name ? {
      directoryIntent: { merchant: { name, category: '', separate: false } },
    } : {}),
  }
}
