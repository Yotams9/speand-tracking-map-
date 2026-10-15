import { handleReceiptOcr, receiptOcrCapability } from '../../../server/receipt-ocr'

export const runtime = 'nodejs'
export const POST = handleReceiptOcr
export const GET = receiptOcrCapability
