import 'server-only'
import { normalizeGeoapify, readSearchResult, validSearchInput, type SearchResult } from '../features/local-purchases/address-search'

export function allowedAddressOrigin(request: Request): boolean {
  try {
    const url = new URL(request.url), host = new URL(`http://${request.headers.get('host') ?? url.host}`), origin = request.headers.get('origin')
    return url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname) && ['127.0.0.1','localhost','[::1]'].includes(host.hostname) && (origin === host.origin || (!origin && request.method === 'GET')) && (!request.headers.get('x-forwarded-host') || request.headers.get('x-forwarded-host') === host.host) && (!request.headers.get('x-forwarded-for') || ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.headers.get('x-forwarded-for')!)) && !['cross-site','same-site'].includes(request.headers.get('sec-fetch-site') ?? '')
  } catch { return false }
}
const respond = (body: unknown, status = 200) => Response.json(body,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
export function createAddressSearchHandler(ports: { enabled: boolean; fictionalQa?: boolean; allowRequest?: (request:Request)=>boolean; reserve: () => Promise<boolean>; search: (input: {address:string;locale:'en'|'he'}, signal: AbortSignal) => Promise<SearchResult> }, timeoutMs = 10_000) {
  return async (request: Request): Promise<Response> => {
    if (!(ports.allowRequest ?? allowedAddressOrigin)(request) || !ports.enabled) return respond({status:'disabled'},503)
    if (request.method === 'GET') return respond({status:'available',...(ports.fictionalQa ? {mode:'fictional-qa'} : {})})
    if (request.method !== 'POST' || request.headers.get('content-type') !== 'application/json') return respond({status:'invalid'},400)
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.signal.addEventListener('abort',abort,{once:true})
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (request.signal.aborted) return respond({status:'cancelled'},409)
      // Bound streamed input before parsing; URLs/history never contain queries.
      let text = '', size = 0
      if (!request.body) return respond({status:'invalid'},400)
      const reader=request.body.getReader(), decoder=new TextDecoder()
      try { for (;;) { const {done,value}=await reader.read(); if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return respond({status:'invalid'},400)}text+=decoder.decode(value,{stream:true}) } text+=decoder.decode() } finally { reader.releaseLock() }
      let input: unknown
      try { input=JSON.parse(text) } catch { return respond({status:'invalid'},400) }
      if (!validSearchInput(input)) return respond({status:'invalid'},400)
      if (request.signal.aborted) return respond({status:'cancelled'},409)
      if (!await ports.reserve()) return respond({status:'consumed'},409)
      if (request.signal.aborted) return respond({status:'cancelled'},409)
      const interrupted = new Promise<SearchResult>(resolve => { controller.signal.addEventListener('abort',()=>resolve({status:request.signal.aborted?'cancelled':'timeout'}),{once:true});timer=setTimeout(()=>controller.abort(),timeoutMs) })
      const result=await Promise.race([ports.search(input,controller.signal).catch(()=>({status:'unavailable'} as const)),interrupted])
      if (controller.signal.aborted) return respond({status:request.signal.aborted?'cancelled':'timeout'},409)
      return respond(readSearchResult(result))
    } catch { return respond({status:'unavailable'},503) }
    finally { clearTimeout(timer);request.signal.removeEventListener('abort',abort) }
  }
}
// This prepared transport is not attached to a native route in this checkpoint.
// A future reviewed activation must supply a durable exclusive one-call reserve.
export function createGeoapifyTransport(getKey: () => string, send: typeof fetch) {
  return async (input: {address:string;locale:'en'|'he'}, signal: AbortSignal): Promise<SearchResult> => {
    if (!validSearchInput(input) || signal.aborted) return {status:'invalid'}
    const key=getKey()
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) return {status:'disabled'}
    const url=new URL('https://api.geoapify.com/v1/geocode/search')
    for (const [k,v] of Object.entries({text:input.address,lang:input.locale,limit:'5',format:'json',bias:'countrycode:none',apiKey:key})) url.searchParams.set(k,v)
    try {
      const response=await send(url,{method:'GET',redirect:'error',cache:'no-store',signal,headers:{accept:'application/json'}})
      if (signal.aborted) return {status:'cancelled'}
      if (!response.ok) { await response.body?.cancel();return {status:response.status===429?'quota':'http-error'} }
      if (!response.headers.get('content-type')?.includes('application/json') || !response.body) { await response.body?.cancel();return {status:'malformed'} }
      const reader=response.body.getReader(), decoder=new TextDecoder();let text='',size=0
      try { for (;;) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65_536){await reader.cancel();return {status:'malformed'}}text+=decoder.decode(value,{stream:true}) }text+=decoder.decode() } finally {reader.releaseLock()}
      // Credential echo must never reach candidates. Provider messages/URLs and
      // extra fields are never returned, logged or durably recorded here.
      if (signal.aborted) return {status:'cancelled'}
      if(text.includes(key))return {status:'malformed'}
      try { return normalizeGeoapify(JSON.parse(text)) } catch { return {status:'malformed'} }
    } catch { return {status:signal.aborted?'cancelled':'unavailable'} }
  }
}
