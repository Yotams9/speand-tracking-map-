import {handleReceiptCapture} from '../../../server/receipt-capture'
import {handleReceiptCaptureQa} from '../../../server/receipt-capture-qa'
import {handleHostedReceipt} from '../../../server/hosted-demo'
export const runtime='nodejs'
export const maxDuration=60
export const dynamic='force-dynamic'
const handler=process.env.SPENDSCAPE_HOSTED_MODE ? handleHostedReceipt : process.env.SPENDSCAPE_RECEIPT_CAPTURE==='fictional-qa'?handleReceiptCaptureQa:handleReceiptCapture
export const GET=handler
export const POST=handler
