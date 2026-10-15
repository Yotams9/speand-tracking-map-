import {receiptToReviewDraft} from '../capture/receipt-review-adapter'
import {structuredObservations} from './structured-image-contract'
import {DIRECT_RESPONSE_BYTES} from './direct-image-contract'
import {ReceiptDecodeFailure,receiptFailureFrom,finishReasons,blockReasons,type ReceiptFailure} from './receipt-failure'
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))
const fail=(category:ReceiptFailure['category'],path:ReceiptFailure['path'],metadata:Partial<ReceiptFailure>={})=>{throw new ReceiptDecodeFailure({category,path,...metadata})}
// Separate operational decoder. Historical successful contract/decoder and its
// frozen launchers remain byte-identical. No expected answers or number repair.
export function captureResponse(raw:unknown) {
 if(!record(raw))return fail('response-structure','response')
 const candidates=raw.candidates
 const block=record(raw.promptFeedback)?raw.promptFeedback.blockReason:undefined
 if(!Array.isArray(candidates)||candidates.length===0){
  if(block!==undefined&&block!=='BLOCK_REASON_UNSPECIFIED')return fail('candidate-blocked','candidates',{blockReason:blockReasons.includes(block as never)?block as ReceiptFailure['blockReason']:'UNKNOWN',candidateCount:0})
  return fail('candidate-missing','candidates',{candidateCount:0})
 }
 const counts={candidateCount:Math.min(candidates.length,16)}
 if(candidates.length!==1||!record(candidates[0]))return fail('response-structure','candidates',counts)
 const c=candidates[0],finish=finishReasons.includes(c.finishReason as never)?c.finishReason as ReceiptFailure['finishReason']:'UNKNOWN'
 if(finish==='MAX_TOKENS')return fail('truncated','candidates[].finishReason',{...counts,finishReason:finish})
 if(finish!=='STOP')return fail('provider-finish','candidates[].finishReason',{...counts,finishReason:finish})
 const parts=record(c.content)?c.content.parts:undefined
 if(!Array.isArray(parts))return fail('response-structure','candidates[].content.parts',{...counts,finishReason:finish})
 const metadata={...counts,finishReason:finish,partCount:Math.min(parts.length,16)}
 if(parts.length>16)return fail('response-structure','candidates[].content.parts',{...metadata,limitExceeded:true})
 const fragments:string[]=[]
 for(const part of parts){
  if(!record(part))return fail('response-structure','candidates[].content.parts',metadata)
  if(part.thought===true)continue
  if(Object.keys(part).some(k=>!['text','thought','thoughtSignature'].includes(k))||part.thought!==undefined&&part.thought!==false||part.thoughtSignature!==undefined&&(typeof part.thoughtSignature!=='string'||part.thoughtSignature.length>64000)||typeof part.text!=='string')return fail('response-structure','candidates[].content.parts',metadata)
  fragments.push(part.text)
 }
 const detail={...metadata,textPartCount:fragments.length}
 if(!fragments.length)return fail('candidate-missing','candidates[].content.parts',detail)
 // Official SDK text getter concatenates non-thought text parts in order.
 // Join exactly: no separators, Markdown stripping, coercion or repaired JSON.
 let text=fragments.join('');let value:unknown
 try{
  if(new TextEncoder().encode(text).length>64000)return fail('response-structure','output.json',{...detail,limitExceeded:true})
  try{value=JSON.parse(text)}catch{return fail('invalid-json','output.json',detail)}
 }finally{text='';fragments.fill('')}
 let observations
 try{observations=structuredObservations(value)}catch{return fail('observation-contract','observations',detail)}
 // Validate draft construction, not unresolved save context. Missing facts must
 // still reach editable review; prepareReceiptReview is the later explicit gate.
 try{receiptToReviewDraft(observations)}catch{return fail('review-contract','review',detail)}
 return observations
}
export async function boundedCaptureJson(response:Response,signal:AbortSignal) {
 const reader=response.body?.getReader();if(!reader)return fail('response-structure','response')
 const decoder=new TextDecoder('utf-8',{fatal:true});let count=0,body=''
 const abort=()=>{void reader.cancel().catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
 try{
  while(true){if(signal.aborted)throw Error('cancelled');const c=await reader.read();if(c.done)break;count+=c.value.length;if(count>DIRECT_RESPONSE_BYTES){await reader.cancel();return fail('response-structure','response',{limitExceeded:true})}try{body+=decoder.decode(c.value,{stream:true})}catch{return fail('response-structure','response')}}
  if(signal.aborted)throw Error('cancelled');try{body+=decoder.decode()}catch{return fail('response-structure','response')}
  try{return JSON.parse(body) as unknown}catch{return fail('invalid-json','response')}
 }catch(error){if(signal.aborted)throw Error('cancelled');if(receiptFailureFrom(error))throw error;return fail('response-structure','response')}finally{signal.removeEventListener('abort',abort);reader.releaseLock();body=''}
}
