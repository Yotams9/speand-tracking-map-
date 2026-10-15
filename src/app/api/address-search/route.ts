import { handleAddressSearch } from '../../../server/address-search-local'
import {localOnly} from '../../../server/hosted-guard'
export const runtime = 'nodejs'
export const GET = localOnly(handleAddressSearch)
export const POST = localOnly(handleAddressSearch)
