import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {DIRECT_MODEL,DIRECT_OUTPUT_TOKENS,DIRECT_PROMPT,DIRECT_SCHEMA} from '../features/receipt-image/direct-image-contract'
import {directPilot,DIRECT_IMAGES} from './direct-image-pilot'

export const DIRECT_RECOVERY_RUN='recovery-20261008-prepay-one'
export const DIRECT_PROJECT='spendscape-receipt-benchmark'
export const DIRECT_PROJECT_NUMBER='376401338717'
export const ORIGINAL_DIRECT_RECORDS={
  'reservation.json':'fd4ca2ab56737aa0c9afd9b287dcf007c88c4b8b2f5fd515d68aae1fdce4f50a',
  'lifecycle.jsonl':'49924dc0b49e0a564a0ef21e7780050dfbe2943e7efc3767d25fba852a094e01',
} as const

// Dated standard rates; not a provider-side dollar limit or an exact token count.
// Reserve 10,000 input text/schema tokens, 2x the documented default image
// allocation, and 2x the documented combined thinking/response cutoff.
export function directRecoveryCost(now=Date.now()) {
  const textBytes=Buffer.byteLength(DIRECT_PROMPT)+Buffer.byteLength(JSON.stringify(DIRECT_SCHEMA))+1024
  if(now>=Date.parse('2027-01-01T00:00:00Z') || DIRECT_MODEL!=='gemini-3.8-flash' || DIRECT_OUTPUT_TOKENS!==8192 || textBytes>10_000)throw new Error('cost-unverified')
  const inputAllowance=10_000+2240,generatedAllowance=DIRECT_OUTPUT_TOKENS*2
  const estimatedMaximumUsd=(inputAllowance*0.75+generatedAllowance*3.75)/1_000_000
  if(estimatedMaximumUsd>0.10)throw new Error('cost-unverified')
  return {estimatedMaximumUsd,inputAllowance,generatedAllowance,textBytes}
}
export function directRecoveryReady(env:NodeJS.ProcessEnv) {
  try {directRecoveryCost()}catch{return false}
  return env.SPENDSCAPE_DIRECT_IMAGE_RUN===DIRECT_RECOVERY_RUN &&
    env.SPENDSCAPE_DIRECT_IMAGE_LOCAL==='1' && env.SPENDSCAPE_DIRECT_IMAGE_PREPAY_CONFIRMED==='1' &&
    env.SPENDSCAPE_DIRECT_IMAGE_PROJECT===DIRECT_PROJECT && env.SPENDSCAPE_DIRECT_IMAGE_PROJECT_NUMBER===DIRECT_PROJECT_NUMBER &&
    /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_DIRECT_IMAGE_VERIFIED_KEY_SHA256??'') &&
    !env.SPENDSCAPE_DIRECT_IMAGE_QA && !env.VERCEL && !env.CI
}
export function verifiedRecoveryKey(key:string,expected:string|undefined) {
  if(!expected || !/^[a-f0-9]{64}$/.test(expected) || createHash('sha256').update(key).digest('hex')!==expected)throw new Error('authentication-failed')
  return key
}
export async function verifyOriginalDirectRecords(originalRoot:string) {
  for(const [name,hash] of Object.entries(ORIGINAL_DIRECT_RECORDS)) {
    if(createHash('sha256').update(await readFile(join(originalRoot,'receipt-1',name))).digest('hex')!==hash)throw new Error('diagnostics-unavailable')
  }
}
// A fixed separately mapped root, one approved hash, one permanent reservation.
// Reuse the existing exclusive/fsync lifecycle implementation, never slot two.
export function directRecoveryPilot(root:string,originalRoot:string) {
  const pilot=directPilot(root)
  return {
    slot:async(hash:string)=>{await verifyOriginalDirectRecords(originalRoot);return hash===DIRECT_IMAGES[0]?pilot.slot(hash):null},
    status:async()=>{await verifyOriginalDirectRecords(originalRoot);return (await pilot.status()).slice(0,1)},
  }
}
