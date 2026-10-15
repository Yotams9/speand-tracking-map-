import 'server-only'
import {createHash} from 'node:crypto'
import {createDirectHandler, directLocal} from '../features/receipt-image/direct-image-boundary'
import {fictionalStructured, structuredEnvelope} from '../features/receipt-image/structured-image-contract'
import {captureResponse} from '../features/receipt-image/structured-capture-response'
import {captureSession} from './receipt-capture-session'
// Explicit opt-in loopback mocks only. No credential reader or provider transport.
export function createCaptureQaHandler(env:NodeJS.ProcessEnv,root=process.cwd()) {
  return async(request:Request)=>{
    if(env.SPENDSCAPE_RECEIPT_CAPTURE!=='fictional-qa'||env.SPENDSCAPE_RECEIPT_QA!=='1'||env.VERCEL||env.CI||!directLocal(request)||request.headers.get('x-spendscape-capture-qa')!=='1'||!/^[a-f0-9]{32}$/.test(env.SPENDSCAPE_RECEIPT_SESSION??''))return Response.json({code:'ocr-unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
    const session=captureSession(root,env.SPENDSCAPE_RECEIPT_SESSION!)
    if(request.method==='GET')try{return Response.json({code:'local-capture-ready',mode:'fictional-qa',session:await session.status()},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({code:'diagnostics-unavailable'},{status:503})}
    return createDirectHandler({enabled:true,fictionalQa:true,hash:b=>createHash('sha256').update(b).digest('hex'),slot:hash=>session.slot(hash),status:session.status,
      recognize:async(_bytes,_mime,signal)=>{if(signal.aborted)throw Error('cancelled');const fixture=request.headers.get('x-spendscape-direct-fixture');const result=structuredEnvelope(fictionalStructured(fixture==='fifteen'?'fifteen':'one'));if(fixture==='multipart'){const text=result.candidates[0].content.parts[0].text,cut=Math.floor(text.length/2);result.candidates[0].content.parts=[{text:text.slice(0,cut)},{text:text.slice(cut)}]}return result},
    },undefined,captureResponse)(request)
  }
}
export const handleReceiptCaptureQa=createCaptureQaHandler(process.env)
