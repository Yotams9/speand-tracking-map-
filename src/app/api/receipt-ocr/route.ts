import { handleReceiptOcr, receiptOcrCapability } from '../../../server/receipt-ocr'
import {localOnly} from '../../../server/hosted-guard'

export const runtime = 'nodejs'
export const POST = localOnly(handleReceiptOcr)
export const GET = localOnly(receiptOcrCapability)
