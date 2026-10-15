import {hashTree} from '../receipt-capture/preparation.mjs'
export const sourceRoots=['src','public','tools/address-search','tools/receipt-capture/preparation.mjs','package.json','package-lock.json','next.config.ts','tsconfig.json','next-env.d.ts']
export {hashTree}
export function launchOptions(args){
 if(args.length===1&&args[0]==='--offline')return {offline:true}
 const flags=['--address-session-approved','--key-project-confirmed','--free-plan-confirmed','--remaining-credits-confirmed','--no-concurrent-use-confirmed','--no-paid-overage-confirmed']
 if(args.length!==8||!flags.every(f=>args.filter(a=>a===f).length===1))throw Error('approval-required')
 const requests=args.find(a=>/^--requests=([1-9]|10)$/.test(a)),expiry=args.find(a=>/^--expires-minutes=([5-9]|[1-9][0-9]|1[01][0-9]|120)$/.test(a))
 if(!requests||!expiry)throw Error('limits-invalid')
 return {offline:false,maxRequests:Number(requests.split('=')[1]),durationMs:Number(expiry.split('=')[1])*60_000}
}
export async function verifyPreparation(root,freeze){
 if(!freeze||Object.keys(freeze).sort().join(',')!=='build,built,source,version'||freeze.version!==1||freeze.build!=='.next'||JSON.stringify(await hashTree(root,sourceRoots))!==JSON.stringify(freeze.source)||JSON.stringify(await hashTree(root,['.next']))!==JSON.stringify(freeze.built))throw Error('build-unverified')
}
export function serverEnvironment(parent,key='',session=''){
 const env={NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'}
 for(const k of ['PATH','TMPDIR','TZ','LANG','LC_ALL'])if(parent[k])env[k]=parent[k]
 if(session){if(!/^[a-f0-9]{32}$/.test(session)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw Error('private-key-unavailable');Object.assign(env,{SPENDSCAPE_ADDRESS_SESSION_MODE:'native',SPENDSCAPE_ADDRESS_SESSION:session,SPENDSCAPE_ADDRESS_FREE_READY:'1',GEOAPIFY_API_KEY:key})}
 return env
}
