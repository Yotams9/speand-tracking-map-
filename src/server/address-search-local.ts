import 'server-only'
import { createAddressSearchHandler } from './address-search-boundary'
import {join} from 'node:path'
import {ADDRESS_ROOT,createNativeAddressHandler,verifyAddressFreeze} from './address-search-native'

import {addressRun,addressRuns} from './address-search-runs'

// Default/hosted/unknown runs remain disabled. Only the fixed frozen user-run
// build can attach native transport; a key by itself never activates it.
export function createLocalAddressHandler(env: NodeJS.ProcessEnv) {
  const root=env.SPENDSCAPE_GEOAPIFY_WORKSPACE??'' // must equal the sole literal worktree below
  const run=addressRun(env.SPENDSCAPE_GEOAPIFY_RUN)
  const config=run?addressRuns[run]:null
  if(run&&config&&root===ADDRESS_ROOT&&!env.VERCEL&&!env.CI&&!env.SPENDSCAPE_ADDRESS_SEARCH_QA&&env.SPENDSCAPE_GEOAPIFY_FREE_CONFIRMED==='1'&&env.SPENDSCAPE_GEOAPIFY_PROJECT_CONFIRMED==='1'&&env.SPENDSCAPE_GEOAPIFY_ALLOWANCE_CONFIRMED==='1'&&env.SPENDSCAPE_GEOAPIFY_NO_CONCURRENT_CONFIRMED==='1'&&env.SPENDSCAPE_GEOAPIFY_NO_PAID_OVERAGE_CONFIRMED==='1'&&process.cwd()===join(root,config.build)&&/^[a-f0-9]{64}$/.test(env.SPENDSCAPE_GEOAPIFY_FREEZE_SHA256??'')&&/^[A-Za-z0-9_-]{16,128}$/.test(env.GEOAPIFY_API_KEY??'')) {
    return createNativeAddressHandler({run,directory:join(root,`artifacts/${run}`),getKey:()=>env.GEOAPIFY_API_KEY??'',send:(url,options)=>fetch(url,options),integrity:()=>verifyAddressFreeze(root,env.SPENDSCAPE_GEOAPIFY_FREEZE_SHA256!,run)})
  }
  const enabled = env.SPENDSCAPE_ADDRESS_SEARCH_QA === 'synthetic' && !env.VERCEL && !env.CI
  return createAddressSearchHandler({enabled,fictionalQa:true,reserve:async()=>true,search:async input => input.address.startsWith('Fictional') ? {status:'results',candidates:[{address:'Fictional street 12',city:'Fictional city',country:'Fictional country',longitude:34.75,latitude:32.1,provenance:{provider:'geoapify',precision:'building',match:'full',pointAdjusted:false}}]} : {status:'invalid'}})
}
export const handleAddressSearch = createLocalAddressHandler(process.env)
