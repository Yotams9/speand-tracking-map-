import { handleAddressSearch } from '../../../server/address-search-local'
import { handleHostedAddress } from '../../../server/hosted-demo'
export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'
const handler = process.env.SPENDSCAPE_HOSTED_MODE ? handleHostedAddress : handleAddressSearch
export const GET = handler
export const POST = handler
