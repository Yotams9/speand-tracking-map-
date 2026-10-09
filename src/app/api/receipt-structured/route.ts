import {handleReceiptStructured} from '../../../server/receipt-structured'
import {handleReceiptStructuredNative} from '../../../server/receipt-structured-native'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A supplied unknown native run is disabled, never downgraded into mock mode.
const handler = process.env.SPENDSCAPE_STRUCTURED_NATIVE_RUN ? handleReceiptStructuredNative : handleReceiptStructured
export const GET = handler
export const POST = handler
