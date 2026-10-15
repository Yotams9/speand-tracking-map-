// Explicit one-time administrative initialization; excluded from ordinary tests.
import {readFileSync, statSync, writeFileSync} from 'node:fs'
import {it} from 'vitest'
import {demoPolicy} from '../src/server/demo-access'
import {createRedisQuota, initializeRedisQuota, redisConfiguration} from '../src/server/demo-quota'
if(process.env.SPENDSCAPE_HOSTED_ADMIN!=='initialize-approved-window-after-ready-preview'||!process.env.SPENDSCAPE_ADMIN_PRIVATE_FILE||!process.env.SPENDSCAPE_ADMIN_RESULT_FILE)throw Error('explicit-administration-required')
const file=process.env.SPENDSCAPE_ADMIN_PRIVATE_FILE
if((statSync(file).mode&0o077)!==0||statSync(file).size>16384)throw Error('private-file-invalid')
const env=JSON.parse(readFileSync(file,'utf8')) as NodeJS.ProcessEnv
const start=Date.parse(env.SPENDSCAPE_DEMO_START_AT??''),now=Date.now()
// The future window must still be inactive. Do not initialize after readiness
// was delayed beyond its start, and never silently extend it.
if(start<=now||start-now>900000||env.SPENDSCAPE_DEMO_RECEIPT_LIMIT!=='2'||env.SPENDSCAPE_DEMO_ADDRESS_LIMIT!=='2'||env.SPENDSCAPE_DEMO_CEILING_MICRO_USD!=='100000')throw Error('activation-window-invalid')
const p=demoPolicy({...env,VERCEL:'1'},start),config=redisConfiguration(env)
if(!p||!config)throw Error('activation-policy-invalid')
let calls=0
const send:typeof fetch=async(url,init)=>{if(url!==config.url||++calls>3)throw Error('administration-bound-exceeded');return fetch(url,init)}
it('establishes exactly one immutable operational record, with no provider request',async()=>{
 await initializeRedisQuota(env,p,send)
 const receipt=await createRedisQuota(env,p,send).status('receipt')
 const address=await createRedisQuota(env,p,send).status('address')
 if(receipt.used!==0||address.used!==0||receipt.status!=='expired'||address.status!=='expired')throw Error('initial-quota-state-unverified')
 writeFileSync(process.env.SPENDSCAPE_ADMIN_RESULT_FILE!,JSON.stringify({status:'initialized-before-start',redisRequests:calls,receiptUsed:receipt.used,addressUsed:address.used,startsAt:new Date(p.startsAt).toISOString(),expiresAt:new Date(p.expiresAt).toISOString(),providerRequests:0}),{flag:'wx',mode:0o600})
})
