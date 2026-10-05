import 'server-only'
import { createOcrHandler } from '../features/receipt-image/ocr-boundary'
import { fictionalOcr } from '../features/receipt-image/ocr-fixtures'
import { handleVisionLocal } from './vision-local'

// This separate switch enables deterministic fictional geometry only.
const handleMockOcr = createOcrHandler(process.env.SPENDSCAPE_RECEIPT_IMAGE_QA === '1', async (fixture, signal) => {
  if (signal.aborted) throw new Error('cancelled')
  return fictionalOcr(fixture)
})

export const handleReceiptOcr = (request: Request) => request.headers.get('x-spendscape-local-vision') === '1' ? handleVisionLocal(request) : handleMockOcr(request)
export const receiptOcrCapability = handleVisionLocal
