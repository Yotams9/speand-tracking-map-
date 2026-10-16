import { handleAddressSearch } from '../../../server/address-search-local'
import { handleHostedAddress } from '../../../server/hosted-demo'
import { hostedOr } from '../../../server/hosted-guard'
export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'
// Hosted presentation/demo mode uses the gated hosted handler; otherwise the route is local-only.
const handler = hostedOr(handleHostedAddress, handleAddressSearch)
export const GET = handler
export const POST = handler
