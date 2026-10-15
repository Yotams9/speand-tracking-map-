import { NextResponse } from 'next/server'
import { catalogStoreSummaries, loadTelAvivCatalog } from '@/data/price-catalog'

export async function GET() {
  try {
    const catalog = await loadTelAvivCatalog()
    return NextResponse.json({ area: catalog.area, locationSource: catalog.locationSource ?? null, stores: catalogStoreSummaries(catalog) }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  } catch {
    return NextResponse.json({ error: 'catalog-unavailable' }, { status: 503 })
  }
}
