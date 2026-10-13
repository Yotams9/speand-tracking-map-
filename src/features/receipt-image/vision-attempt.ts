import {validReceiptFailure,type ReceiptFailure} from './receipt-failure'
import {validRowRejection,type RowRejection} from './row-rejection'
import { layoutReasons, type LayoutReason } from './layout-reason'
import { validGeminiErrorDiagnostic, type GeminiErrorDiagnostic } from './gemini-error-diagnostic'
export const attemptStages = ['reserved', 'authentication-start', 'authentication-complete', 'dispatch-initiated', 'provider-http', 'normalization-start', 'normalization-complete', 'parsing-start', 'parsing-complete', 'review-response-complete', 'failure', 'interrupted'] as const
export type AttemptStage = typeof attemptStages[number]
const failures = ['authentication-failed','transport-failed','recognition-failed','recognition-empty','normalization-failed','layout-unsupported','ocr-invalid','diagnostics-unavailable','cancelled'] as const
const googleCodes = [...Array.from({length:17},(_,i)=>i),400,401,403,404,409,429,499,500,501,503,504]
const googleStatuses = ['INVALID_ARGUMENT','UNAUTHENTICATED','PERMISSION_DENIED','RESOURCE_EXHAUSTED','DEADLINE_EXCEEDED','UNAVAILABLE','INTERNAL','UNKNOWN','NOT_FOUND','FAILED_PRECONDITION','CANCELLED','OUT_OF_RANGE','ABORTED','ALREADY_EXISTS','DATA_LOSS','UNIMPLEMENTED'] as const
export interface AttemptEvent { stage: AttemptStage; elapsedMs: number; httpStatus?: number; googleCode?: number; googleStatus?: string; code?: string; layoutReason?: LayoutReason; rowRejection?: RowRejection; geminiError?: GeminiErrorDiagnostic; receiptFailure?:ReceiptFailure }
export type AttemptEmit = (stage: AttemptStage, metadata?: unknown) => Promise<void>
export interface AttemptSession { emit: AttemptEmit }
export interface AttemptDiagnostics { start: () => Promise<AttemptSession>; status: () => Promise<{version:1; state:'complete'|'failed'|'interrupted'|'incomplete'; events:AttemptEvent[]} | null> }
// Pick known fields only. Arbitrary messages/keys and all receipt values are lost.
export function safeAttemptEvent(stage: AttemptStage, elapsedMs: number, raw: unknown = {}): AttemptEvent {
  if (!attemptStages.includes(stage)) throw new Error('diagnostics-unavailable')
  const m = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {}
  const event: AttemptEvent = {stage,elapsedMs:Math.min(60_000,Math.max(0,Math.round(elapsedMs)))}
  if (stage === 'provider-http') {
    if (Number.isInteger(m.httpStatus) && Number(m.httpStatus)>=100 && Number(m.httpStatus)<=599) event.httpStatus=Number(m.httpStatus)
    if (Number.isInteger(m.googleCode) && googleCodes.includes(Number(m.googleCode))) event.googleCode=Number(m.googleCode)
    if (googleStatuses.includes(m.googleStatus as typeof googleStatuses[number])) event.googleStatus=m.googleStatus as string
    if (event.httpStatus !== undefined && event.httpStatus >= 400 && validGeminiErrorDiagnostic(m.geminiError)) event.geminiError=structuredClone(m.geminiError)
  }
  if (stage === 'failure' || stage === 'interrupted') if (failures.includes(m.code as typeof failures[number])) event.code=m.code as string
  if (stage === 'failure' && m.code === 'layout-unsupported' && layoutReasons.includes(m.layoutReason as LayoutReason)) event.layoutReason=m.layoutReason as LayoutReason
  if(stage==='failure' && event.layoutReason==='item-row-unassigned' && validRowRejection(m.rowRejection))event.rowRejection=structuredClone(m.rowRejection)
  if(stage==='failure' && event.code==='ocr-invalid' && validReceiptFailure(m.receiptFailure))event.receiptFailure=structuredClone(m.receiptFailure)
  return event
}
export const terminalStage = (stage: AttemptStage) => ['review-response-complete','failure','interrupted'].includes(stage)
