import 'server-only'
import { createOcrHandler } from '../features/receipt-image/ocr-boundary'
import { fictionalOcr } from '../features/receipt-image/ocr-fixtures'

// This local test switch enables only deterministic synthetic geometry. There
// is intentionally no live adapter, credential read or provider fallback.
export const handleReceiptOcr = createOcrHandler(process.env.SPENDSCAPE_RECEIPT_IMAGE_QA === '1', async (fixture, signal) => {
  if (signal.aborted) throw new Error('cancelled')
  return fictionalOcr(fixture)
})
