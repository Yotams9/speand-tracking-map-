import {handleReceiptDirect} from '../../../server/receipt-direct'
import {localOnly} from '../../../server/hosted-guard'
export const runtime='nodejs'
export const GET=localOnly(handleReceiptDirect)
export const POST=localOnly(handleReceiptDirect)
