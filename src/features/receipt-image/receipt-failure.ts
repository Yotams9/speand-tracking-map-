import type {ReviewErrors} from '../capture/session-purchase-domain'
export const failureCategories = ['candidate-missing','candidate-blocked','response-structure','truncated','provider-finish','invalid-json','observation-contract','review-contract','review-validation'] as const
export const failurePaths = ['response','candidates','candidates[].finishReason','candidates[].content.parts','output.json','observations','review'] as const
export const finishReasons = ['FINISH_REASON_UNSPECIFIED','STOP','MAX_TOKENS','SAFETY','RECITATION','LANGUAGE','OTHER','BLOCKLIST','PROHIBITED_CONTENT','SPII','MALFORMED_FUNCTION_CALL','IMAGE_SAFETY','IMAGE_PROHIBITED_CONTENT','IMAGE_OTHER','NO_IMAGE','IMAGE_RECITATION','UNEXPECTED_TOOL_CALL','TOO_MANY_TOOL_CALLS','MISSING_THOUGHT_SIGNATURE','MALFORMED_RESPONSE','ESCALATION','PUP_LIMITED_DISABLED','UNKNOWN'] as const
export const blockReasons = ['BLOCK_REASON_UNSPECIFIED','SAFETY','OTHER','BLOCKLIST','PROHIBITED_CONTENT','IMAGE_SAFETY','UNKNOWN'] as const
const reviewFields = ['date','currency','amount','merchantId','merchantName','merchantCategory','merchantSeparate','placeId','channel','payment','category','baseAmount','directory','lines','place-branch','place-city','place-country','place-address','place-longitude','place-latitude','place-confirmed','place-separate','lines.name','lines.quantity','lines.price','lines.unit','lines.printedAmount','lines.discount','other'] as const
export interface ReceiptFailure {version:1; category:typeof failureCategories[number]; path:typeof failurePaths[number]; finishReason?:typeof finishReasons[number]; blockReason?:typeof blockReasons[number]; candidateCount?:number; partCount?:number; textPartCount?:number; limitExceeded?:boolean; fieldPaths?:string[]}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))
export function validReceiptFailure(value:unknown):value is ReceiptFailure {
 if(!object(value)||Object.keys(value).some(k=>!['version','category','path','finishReason','blockReason','candidateCount','partCount','textPartCount','limitExceeded','fieldPaths'].includes(k))||value.version!==1||!failureCategories.includes(value.category as never)||!failurePaths.includes(value.path as never))return false
 const paths:Record<string,readonly string[]>={'candidate-missing':['candidates','candidates[].content.parts'],'candidate-blocked':['candidates'],'response-structure':['response','candidates','candidates[].content.parts','output.json'],'truncated':['candidates[].finishReason'],'provider-finish':['candidates[].finishReason'],'invalid-json':['response','output.json'],'observation-contract':['observations'],'review-contract':['review'],'review-validation':['review']}
 if(!paths[value.category as string].includes(value.path as string)||value.category==='truncated'&&value.finishReason!=='MAX_TOKENS'||value.category==='provider-finish'&&(value.finishReason===undefined||value.finishReason==='STOP'||value.finishReason==='MAX_TOKENS'))return false
 if(value.finishReason!==undefined&&!finishReasons.includes(value.finishReason as never)||value.blockReason!==undefined&&!blockReasons.includes(value.blockReason as never)||value.limitExceeded!==undefined&&typeof value.limitExceeded!=='boolean')return false
 for(const k of ['candidateCount','partCount','textPartCount'])if(value[k]!==undefined&&(!Number.isInteger(value[k])||Number(value[k])<0||Number(value[k])>16))return false
 if(value.fieldPaths!==undefined){const a=value.fieldPaths;if(!Array.isArray(a)||a.length>8||Reflect.ownKeys(a).length!==a.length+1)return false;for(let i=0;i<a.length;i++){const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d||!Object.hasOwn(d,'value')||!reviewFields.includes(d.value)||!d.enumerable)return false}}
 return true
}
export class ReceiptDecodeFailure extends Error {
 readonly receiptFailure:ReceiptFailure
 constructor(detail:Omit<ReceiptFailure,'version'>){super('ocr-invalid');const value={version:1 as const,...detail};if(!validReceiptFailure(value))throw Error('diagnostics-unavailable');this.receiptFailure=structuredClone(value)}
}
export function receiptFailureFrom(error:unknown):ReceiptFailure|undefined {
 return error instanceof ReceiptDecodeFailure&&validReceiptFailure(error.receiptFailure)?structuredClone(error.receiptFailure):undefined
}
// Actual prepareReceiptReview/validateReview errors only. No receipt values,
// arbitrary validator strings or storage writes; this remains transient UI data.
export function reviewFailure(errors:ReviewErrors):ReceiptFailure|undefined {
 const keys=Object.keys(errors);if(!keys.length)return undefined
 const fields=keys.map(key=>{const row=/^(name|quantity|price|unit|printedAmount|discount)-(\d{1,2})$/.exec(key);return row&&Number(row[2])<50?`lines.${row[1]}`:reviewFields.includes(key as never)?key:'other'})
 return {version:1,category:'review-validation',path:'review',fieldPaths:[...new Set(fields)].slice(0,8)}
}
