import {rows,validateOcrDocument,type OcrDocument,type RowKind} from './ocr-parser'
import {parseVisionReceipt} from './short-receipt-parser'
import {layoutReason,layoutReasons,type LayoutReason} from './layout-reason'
export const INSPECTION_MS=120_000
const kinds:RowKind[]=['header','item','continuation','numeric-details','summary','unassigned']
export interface ParserInspection {version:1;document:OcrDocument;rows:{words:number[];kind:RowKind;rejected:boolean}[];reason:LayoutReason|null}
// Pure, opt-in diagnostic view. No logging, persistence, financial correction,
// provider access or retained module-level receipt state.
export function inspectParser(document:OcrDocument){
 if(!validateOcrDocument(document))throw new Error('ocr-invalid')
 const grouped=rows(document.words,.65)
 const inspection:ParserInspection={version:1,document,rows:grouped.map(row=>({words:row.map(w=>document.words.indexOf(w)),kind:'unassigned',rejected:false})),reason:null}
 const trace=(row:typeof document.words,kind:RowKind,rejected=false)=>{const indices=row.map(w=>document.words.indexOf(w));const target=inspection.rows.find(r=>r.words.length===indices.length&&r.words.every(i=>indices.includes(i)));if(target){target.kind=kind;target.rejected=rejected}}
 try{return {parsed:parseVisionReceipt(document,trace),inspection}}
 catch(error){const reason=layoutReason(error);if(!reason)throw error;inspection.reason=reason;return {error,inspection}}
}
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))
export function validateParserInspection(raw:unknown):raw is ParserInspection{
 if(!plain(raw,['version','document','rows','reason'])||raw.version!==1||!validateOcrDocument(raw.document)||!(raw.reason===null||layoutReasons.includes(raw.reason as LayoutReason))||!Array.isArray(raw.rows)||raw.rows.length>1500||Reflect.ownKeys(raw.rows).length!==raw.rows.length+1)return false
 const doc=raw.document,used=new Set<number>()
 for(const row of raw.rows){if(!plain(row,['words','kind','rejected'])||!kinds.includes(row.kind as RowKind)||typeof row.rejected!=='boolean'||!Array.isArray(row.words)||!row.words.length||Reflect.ownKeys(row.words).length!==row.words.length+1)return false
 for(const i of row.words){if(!Number.isInteger(i)||i<0||i>=doc.words.length||used.has(i))return false;used.add(i)}}
 return used.size===doc.words.length
}
