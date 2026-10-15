// Predicate results only. No receipt text, values or geometric measurements.
export const rejectionChecks = {
  'labelled-continuation': ['near-item','description-structure'],
  'labelled-item': ['name-present','financial-present'],
  'short-leading': ['single-prefix','word-limit','numeric-structure','amount-column','description-anchor','forward-baseline','near-baseline','unique-item'],
  'short-following': ['near-item','description-structure','description-column','numeric-structure','numeric-column'],
} as const
export type RejectionPath = keyof typeof rejectionChecks
export interface RowRejection {
  path: RejectionPath
  rowOrdinal: number
  rowCount: number
  wordCount: number
  checks: Record<string, boolean>
}
function plain(value:unknown):value is Record<string,unknown>{return !!value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype && Reflect.ownKeys(value).every(key=>typeof key==='string' && Object.getOwnPropertyDescriptor(value,key)?.enumerable && Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)!,'value'))}
export function validRowRejection(value:unknown):value is RowRejection {
  if(!plain(value) || Reflect.ownKeys(value).length!==5 || !['path','rowOrdinal','rowCount','wordCount','checks'].every(k=>Object.hasOwn(value,k)) || typeof value.path!=='string' || !Object.hasOwn(rejectionChecks,value.path))return false
  if(![value.rowOrdinal,value.rowCount,value.wordCount].every(n=>Number.isInteger(n) && Number(n)>=1 && Number(n)<=1500) || Number(value.rowOrdinal)>Number(value.rowCount) || !plain(value.checks))return false
  const keys=rejectionChecks[value.path as RejectionPath]
  return Reflect.ownKeys(value.checks).length===keys.length && keys.every(k=>Object.hasOwn(value.checks as object,k) && typeof (value.checks as Record<string,unknown>)[k]==='boolean') && Object.values(value.checks).some(v=>v===false)
}
// Inputs are the predicates used by the parser itself, not a second classifier.
export function rowRejection(path:RejectionPath,rowOrdinal:number,rowCount:number,wordCount:number,checks:Record<string,boolean>):RowRejection {
  const value={path,rowOrdinal,rowCount,wordCount,checks}
  if(!validRowRejection(value))throw new Error('ocr-invalid')
  return value
}
