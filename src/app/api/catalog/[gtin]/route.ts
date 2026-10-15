import { NextResponse } from 'next/server'
import { loadTelAvivCatalog, lookupInCatalog, validGtin14 } from '@/data/price-catalog'

export async function GET(_request: Request, { params }: { params: Promise<{ gtin: string }> }) {
  const { gtin } = await params
  if (!validGtin14(gtin)) return NextResponse.json({ error: 'invalid-gtin' }, { status: 400 })
  let product
  try {
    product = lookupInCatalog(await loadTelAvivCatalog(), gtin)
  } catch {
    return NextResponse.json({ error: 'catalog-unavailable' }, { status: 503 })
  }
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json(product, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
