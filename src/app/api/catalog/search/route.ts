import { loadTelAvivCatalog } from '@/data/price-catalog'
import { searchInCatalog } from '@/data/catalog-search'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (request.headers.get('content-type') !== 'application/json') return Response.json({ error: 'invalid-query' }, { status: 400 })
  const reader = request.body?.getReader(); if (!reader) return Response.json({ error: 'invalid-query' }, { status: 400 })
  let body = '', bytes = 0
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 1024) { await reader.cancel(); throw 0 }; body += decoder.decode(chunk.value, { stream: true }) }; body += decoder.decode()
    const value = JSON.parse(body)
    if (!value || Object.keys(value).join(',') !== 'query' || typeof value.query !== 'string' || value.query.trim().length < 2 || value.query.length > 100 || /[\u0000-\u001f\u007f]/.test(value.query)) throw 0
    const result = searchInCatalog(await loadTelAvivCatalog(), value.query)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'catalog-search-unavailable' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }) }
  finally { reader.releaseLock() }
}
