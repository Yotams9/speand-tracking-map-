import { NextResponse } from 'next/server'
import { loadTelAvivCatalog } from '../../../data/price-catalog'
import { computeSavings } from '../../../features/savings/savings-engine'
import { MAX_SAVINGS_BODY_BYTES, parseSavingsRequest } from '../../../features/savings/savings-request'

// The 5 MB catalog stays on the server; the browser sends only barcodes,
// quantities and an origin, and nothing is stored or forwarded.
export async function POST(request: Request) {
  const text = await request.text().catch(() => null)
  if (text === null || text.length > MAX_SAVINGS_BODY_BYTES) return NextResponse.json({ error: 'body' }, { status: 400 })
  let body: unknown
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'json' }, { status: 400 }) }
  const parsed = parseSavingsRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  let catalog
  try {
    catalog = await loadTelAvivCatalog()
  } catch {
    return NextResponse.json({ error: 'catalog-unavailable' }, { status: 503 })
  }
  const { items, origin, radiusM } = parsed.request
  return NextResponse.json(computeSavings(catalog, items, origin, radiusM), { headers: { 'Cache-Control': 'no-store' } })
}
