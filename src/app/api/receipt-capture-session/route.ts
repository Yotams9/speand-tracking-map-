import {handleReceiptCapture} from '../../../server/receipt-capture'
import {handleReceiptCaptureQa} from '../../../server/receipt-capture-qa'
import {handleHostedReceipt} from '../../../server/hosted-demo'
import {hostedOr} from '../../../server/hosted-guard'
export const runtime='nodejs'
export const maxDuration=60
export const dynamic='force-dynamic'
// Hosted presentation/demo mode uses the gated hosted handler; otherwise the route is local-only.
const handler=hostedOr(handleHostedReceipt, process.env.SPENDSCAPE_RECEIPT_CAPTURE==='fictional-qa'?handleReceiptCaptureQa:handleReceiptCapture)
export const GET=handler
export const POST=handler
