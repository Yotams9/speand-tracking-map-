import {handleReceiptCapture} from '../../../server/receipt-capture'
import {handleReceiptCaptureQa} from '../../../server/receipt-capture-qa'
import {localOnly} from '../../../server/hosted-guard'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const handler=process.env.SPENDSCAPE_RECEIPT_CAPTURE==='fictional-qa'?handleReceiptCaptureQa:handleReceiptCapture
export const GET=localOnly(handler)
export const POST=localOnly(handler)
