import { validGtin14 } from '../../data/price-catalog'
import { DEFAULT_SAVINGS_RADIUS_M, MAX_SAVINGS_ITEMS, type SavingsItemInput, type SavingsOrigin } from './savings-engine'

export const MAX_SAVINGS_RADIUS_M = 20_000
export const MAX_SAVINGS_BODY_BYTES = 32_000
const MAX_QUANTITY = 1_000_000
const MAX_PAID_MINOR = 100_000_000

export interface SavingsRequest { items: SavingsItemInput[]; origin: SavingsOrigin; radiusM: number }
export type SavingsRequestCheck = { ok: true; request: SavingsRequest } | { ok: false; error: string }

const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

// Strict: unknown fields, malformed barcodes, out-of-range numbers and oversized
// input are rejected rather than repaired. A missing barcode is allowed; the
// engine lists that line as not compared.
export function parseSavingsRequest(body: unknown): SavingsRequestCheck {
  const fail = (error: string): SavingsRequestCheck => ({ ok: false, error })
  if (!plain(body) || !only(body, ['items', 'origin', 'radiusM'])) return fail('body')
  const { items, origin, radiusM } = body
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_SAVINGS_ITEMS) return fail('items')
  const parsed: SavingsItemInput[] = []
  for (const item of items) {
    if (!plain(item) || !only(item, ['ref', 'gtin14', 'quantity', 'unit', 'paidMinor'])) return fail('item')
    const { ref, gtin14, quantity, unit, paidMinor } = item
    if (ref !== undefined && (typeof ref !== 'string' || ref.length > 100)) return fail('ref')
    if (gtin14 !== undefined && gtin14 !== null && (typeof gtin14 !== 'string' || !validGtin14(gtin14))) return fail('gtin14')
    if (!finite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) return fail('quantity')
    if (unit !== undefined && unit !== 'item' && unit !== 'kg') return fail('unit')
    if (paidMinor !== undefined && (!Number.isSafeInteger(paidMinor) || (paidMinor as number) < 0 || (paidMinor as number) > MAX_PAID_MINOR)) return fail('paidMinor')
    parsed.push({
      ...(ref !== undefined ? { ref } : {}), gtin14: (gtin14 as string | null | undefined) ?? null, quantity,
      ...(unit !== undefined ? { unit } : {}), ...(paidMinor !== undefined ? { paidMinor: paidMinor as number } : {}),
    })
  }
  if (!plain(origin) || !only(origin, ['lat', 'lon', 'storeId'])) return fail('origin')
  const { lat, lon, storeId } = origin
  if (!finite(lat) || !finite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail('origin')
  if (storeId !== undefined && (typeof storeId !== 'string' || !/^[a-z]{1,20}-\d{1,6}$/.test(storeId))) return fail('storeId')
  let radius = DEFAULT_SAVINGS_RADIUS_M
  if (radiusM !== undefined) {
    if (!Number.isSafeInteger(radiusM) || (radiusM as number) < 1 || (radiusM as number) > MAX_SAVINGS_RADIUS_M) return fail('radiusM')
    radius = radiusM as number
  }
  return { ok: true, request: { items: parsed, origin: { lat, lon, ...(storeId !== undefined ? { storeId } : {}) }, radiusM: radius } }
}
