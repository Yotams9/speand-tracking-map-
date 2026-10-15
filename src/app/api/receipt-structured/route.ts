import {handleReceiptStructured} from '../../../server/receipt-structured'
import {handleReceiptStructuredNative} from '../../../server/receipt-structured-native'
import {localOnly} from '../../../server/hosted-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A supplied unknown native run is disabled, never downgraded into mock mode.
const handler = process.env.SPENDSCAPE_STRUCTURED_NATIVE_RUN ? handleReceiptStructuredNative : handleReceiptStructured
export const GET = localOnly(handler)
export const POST = localOnly(handler)
