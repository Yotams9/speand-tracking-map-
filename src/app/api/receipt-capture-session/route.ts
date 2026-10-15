import {handleReceiptCapture} from '../../../server/receipt-capture'
import {handleReceiptCaptureQa} from '../../../server/receipt-capture-qa'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const handler=process.env.SPENDSCAPE_RECEIPT_CAPTURE==='fictional-qa'?handleReceiptCaptureQa:handleReceiptCapture
export const GET=handler
export const POST=handler
