import { denseArray, exactObject } from './local-structure'

export const resultPrecisions = ['unknown','amenity','building','street','suburb','district','postcode','city','county','state','country'] as const
export type ResultPrecision = typeof resultPrecisions[number]
export type AddressSearchProvenance = { provider: 'geoapify'; precision: ResultPrecision; match: 'full' | 'partial' | 'unknown'; pointAdjusted: boolean }
export type AddressCandidate = { address: string; city: string; country: string; longitude: number; latitude: number; provenance: AddressSearchProvenance }
export const searchErrors = ['disabled','invalid','no-results','timeout','cancelled','quota','http-error','malformed','unavailable','consumed','expired','limit-reached','session-stopped','busy','duplicate'] as const
export type SearchError = typeof searchErrors[number]
export type SearchResult = { status: 'results'; candidates: AddressCandidate[] } | { status: SearchError }
const boundedText = (v: unknown, optional = false): v is string => typeof v === 'string' && v === v.trim() && v.length <= 100 && (optional || v.length > 1) && !/[\u0000-\u001f\u007f-\u009f<>]|https?:\/\//i.test(v)
export function validSearchInput(v: unknown): v is { address: string; locale: 'en' | 'he' } {
  return exactObject(v,['address','locale']) && boundedText(v.address) && ['en','he'].includes(v.locale as string)
}
export function validSearchProvenance(v: unknown): v is AddressSearchProvenance {
  return exactObject(v,['provider','precision','match','pointAdjusted']) && v.provider === 'geoapify' && resultPrecisions.includes(v.precision as ResultPrecision) && ['full','partial','unknown'].includes(v.match as string) && typeof v.pointAdjusted === 'boolean'
}
export const needsPointAdjustment = (p: AddressSearchProvenance) => !p.pointAdjusted && (!['building','amenity'].includes(p.precision) || p.match !== 'full')
// Match the existing storage coordinate format; this is representation precision,
// not evidence that a geocoded point is accurate to eight decimal places.
export const candidatePoint = (c: AddressCandidate): [number,number] => [Number(c.longitude.toFixed(8)),Number(c.latitude.toFixed(8))]
export const pointInputs = (point: [number,number]) => ({longitude:point[0].toFixed(8),latitude:point[1].toFixed(8)})
export function validCandidate(v: unknown): v is AddressCandidate {
  return exactObject(v,['address','city','country','longitude','latitude','provenance']) && boundedText(v.address) && boundedText(v.city,true) && boundedText(v.country,true) && typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180 && typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 && validSearchProvenance(v.provenance) && v.provenance.pointAdjusted === false
}
export function readSearchResult(v: unknown): SearchResult {
  if (exactObject(v,['status']) && searchErrors.includes(v.status as SearchError)) return v as SearchResult
  if (!exactObject(v,['status','candidates']) || v.status !== 'results' || !denseArray(v.candidates,5) || !v.candidates.length || !v.candidates.every(validCandidate)) return { status:'malformed' }
  return v as SearchResult
}
// Whitelist projections only. Unsupported data sources fail closed: additional
// attribution/reuse obligations must be reviewed before displaying their data.
export function normalizeGeoapify(v: unknown): SearchResult {
  if (!v || typeof v !== 'object' || !denseArray((v as Record<string,unknown>).results,5)) return {status:'malformed'}
  const rows = (v as {results: unknown[]}).results
  if (!rows.length) return {status:'no-results'}
  const candidates: AddressCandidate[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') return {status:'malformed'}
    const r = row as Record<string,any>
    if (r.datasource?.sourcename !== 'openstreetmap' || !resultPrecisions.includes(r.result_type)) return {status:'malformed'}
    const match = r.rank?.match_type === 'full_match' ? 'full' : ['inner_part','match_by_building','match_by_street','match_by_postcode','match_by_city_or_disrict','match_by_country_or_state'].includes(r.rank?.match_type) ? 'partial' : 'unknown'
    const c: AddressCandidate = {address:r.formatted, city:r.city ?? '', country:r.country ?? '', longitude:r.lon, latitude:r.lat, provenance:{provider:'geoapify',precision:r.result_type,match,pointAdjusted:false}}
    if (!validCandidate(c)) return {status:'malformed'}
    candidates.push(c)
  }
  return {status:'results',candidates}
}

export async function readAddressResponse(response: Response): Promise<SearchResult> {
  if (!response.body || !response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel();return {status:'malformed'} }
  const reader=response.body.getReader(), decoder=new TextDecoder();let text='',size=0
  try { for (;;) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32_768){await reader.cancel();return {status:'malformed'}}text+=decoder.decode(value,{stream:true}) }text+=decoder.decode() } finally {reader.releaseLock()}
  try { const result=readSearchResult(JSON.parse(text));return !response.ok && result.status==='results' ? {status:'unavailable'} : result } catch {return {status:'malformed'}}
}
