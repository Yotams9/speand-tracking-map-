import {createHash} from 'node:crypto'
import {mkdir,open,readFile,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {visionAttemptRecord} from './vision-attempt-record'
import {DIRECT_PROJECT,DIRECT_PROJECT_NUMBER,directRecoveryCost} from './direct-image-recovery'
import type {DirectSlot} from '../features/receipt-image/direct-image-boundary'

export const DIRECT_DIAGNOSTIC_RUN='diagnostic-20261009-rejected-field-one'
export const DIRECT_DIAGNOSTIC_IMAGE='f309579ac77c22676d778758c1cc909bb33c0e4ab3fb7a65af180c3876360292'
export const DIRECT_DIAGNOSTIC_HISTORY={
  'receipt-direct-image-20261008-two/receipt-1/reservation.json':'fd4ca2ab56737aa0c9afd9b287dcf007c88c4b8b2f5fd515d68aae1fdce4f50a',
  'receipt-direct-image-20261008-two/receipt-1/lifecycle.jsonl':'49924dc0b49e0a564a0ef21e7780050dfbe2943e7efc3767d25fba852a094e01',
  'receipt-direct-image-recovery-20261008-prepay-one/receipt-1/reservation.json':'fd4ca2ab56737aa0c9afd9b287dcf007c88c4b8b2f5fd515d68aae1fdce4f50a',
  'receipt-direct-image-recovery-20261008-prepay-one/receipt-1/lifecycle.jsonl':'bdf964989448ad976d0519aeb1279073fbbaeeba764129d0a842632a7545b713',
} as const
export function directDiagnosticReady(env:NodeJS.ProcessEnv) {
  try{directRecoveryCost()}catch{return false}
  return env.SPENDSCAPE_DIRECT_IMAGE_RUN===DIRECT_DIAGNOSTIC_RUN &&
    env.SPENDSCAPE_DIRECT_IMAGE_DIAGNOSTIC_APPROVED==='1' &&
    env.SPENDSCAPE_DIRECT_IMAGE_LOCAL==='1' && env.SPENDSCAPE_DIRECT_IMAGE_PREPAY_CONFIRMED==='1' &&
    env.SPENDSCAPE_DIRECT_IMAGE_PROJECT===DIRECT_PROJECT && env.SPENDSCAPE_DIRECT_IMAGE_PROJECT_NUMBER===DIRECT_PROJECT_NUMBER &&
    /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_DIRECT_IMAGE_VERIFIED_KEY_SHA256??'') &&
    !env.SPENDSCAPE_DIRECT_IMAGE_QA && !env.VERCEL && !env.CI
}
type HistoryRoots={original:string;recovery:string}
export async function verifyDiagnosticHistory(roots:HistoryRoots) {
  try{
    for(const [path,hash] of Object.entries(DIRECT_DIAGNOSTIC_HISTORY)) {
      const root=path.startsWith('receipt-direct-image-20261008-two/')?roots.original:roots.recovery
      const name=path.endsWith('/reservation.json')?'reservation.json':'lifecycle.jsonl'
      if(createHash('sha256').update(await readFile(join(root,'receipt-1',name))).digest('hex')!==hash)throw new Error()
    }
  }catch{throw new Error('diagnostics-unavailable')}
}
// Production supplies three literal, fixed run roots. Tests inject isolated
// directories; there is no environment path override or broad artifacts scan.
export function directDiagnosticPilot(runRoot:string,history:HistoryRoots) {
  const directory=join(runRoot,'receipt-1')
  const reservation=join(directory,'reservation.json'),diagnostics=visionAttemptRecord(join(directory,'lifecycle.jsonl'))
  const slot:DirectSlot={diagnostics,consumed:async()=>{
    try{await stat(reservation);return true}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw new Error('diagnostics-unavailable')}
  },reserve:async()=>{
    await verifyDiagnosticHistory(history)
    await mkdir(directory,{recursive:true,mode:0o700})
    let file;try{file=await open(reservation,'wx',0o600)}catch{throw new Error('attempt-consumed')}
    try{
      await file.writeFile(JSON.stringify({version:1,attempt:1,feature:'generateContent',maximumRequests:1})+'\n')
      await file.sync();const dir=await open(directory,'r');try{await dir.sync()}finally{await dir.close()}
    }finally{await file.close()}
  }}
  return {slot:async(hash:string)=>{await verifyDiagnosticHistory(history);return hash===DIRECT_DIAGNOSTIC_IMAGE?slot:null},
    status:async()=>{await verifyDiagnosticHistory(history);return [{attempt:1,consumed:await slot.consumed(),record:await diagnostics.status()}]}}
}
