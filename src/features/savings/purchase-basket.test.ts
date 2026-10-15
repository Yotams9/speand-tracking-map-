import { describe, expect, it } from 'vitest'
import type { GlobePurchase, Place } from '../../data/spendscape-globe'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import { savingsBasket } from './purchase-basket'

const GTIN = '07290008464741'
const item = (id: string, quantity = 2, lineTotal = 63.8, unit: 'item' | 'kg' = 'item') => ({ id, label: { en: id, he: id }, quantity, unit, unitPrice: lineTotal / quantity, lineTotal })
const purchase = (patch: Partial<GlobePurchase> = {}): GlobePurchase => ({
  provenance: 'user-reviewed-session', id: 'session_purchase_1', merchantId: 'm1', timestamp: '2026-10-10T10:00:00.000Z', channel: 'physical', resolution: 'confirmed',
  paymentMode: 'card', placeId: 'p1', category: 'groceries', originalAmount: 63.8, originalCurrency: 'ILS',
  fx: { baseCurrency: 'ILS', rateToBase: 1, effectiveAt: '2026-10-10T10:00:00.000Z', source: 'identity', label: { en: '', he: '' } },
  items: [item('0')], evidenceIds: [], ...patch,
})
const record = (p: GlobePurchase, patch: Partial<SessionCaptureRecord> = {}): SessionCaptureRecord => ({
  purchase: p, evidence: {} as SessionCaptureRecord['evidence'], source: 'barcode', synthetic: false,
  identification: { method: 'manual', syntheticCatalog: false, identity: { original: '7290008464741', format: 'EAN13', gtin14: GTIN } as never }, ...patch,
})
const place = (patch: Record<string, unknown> = {}) => ({
  id: 'p1', merchantId: 'm1', name: { en: 'Shufersal', he: 'שופרסל' }, branch: { en: 'Ben Yehuda', he: 'בן יהודה' }, city: { en: '', he: '' }, country: { en: '', he: '' },
  coordinates: [34.770485, 32.081361], category: 'groceries', ...patch,
}) as unknown as Place
const catalogPlace = place({ catalogStore: { storeId: 'shufersal-1', chain: 'shufersal', publishedAddress: 'בן יהודה 79' }, locationMethod: 'catalog-store', address: 'בן יהודה 79' })

describe('savings basket from a saved purchase', () => {
  it('attaches the barcode to a single-line purchase with the paid amount in agorot', () => {
    const p = purchase()
    expect(savingsBasket(p, record(p), [catalogPlace])).toEqual({
      items: [{ ref: '0', gtin14: GTIN, quantity: 2, unit: 'item', paidMinor: 6380 }],
      origin: { lat: 32.081361, lon: 34.770485, storeId: 'shufersal-1' },
    })
  })
  it('uses the place coordinates without a store ID for an ordinary place', () => {
    const p = purchase()
    expect(savingsBasket(p, record(p), [place()])?.origin).toEqual({ lat: 32.081361, lon: 34.770485 })
  })
  it('never guesses which line a barcode belongs to', () => {
    const p = purchase({ items: [item('0'), item('1')] })
    expect(savingsBasket(p, record(p), [catalogPlace])?.items.map(i => i.gtin14)).toEqual([null, null])
  })
  it('has no origin when the place is unresolved, online or missing', () => {
    for (const p of [purchase({ resolution: 'unresolved' }), purchase({ channel: 'online', placeId: null }), purchase({ placeId: 'gone' })]) {
      expect(savingsBasket(p, record(p), [catalogPlace])?.origin).toBeNull()
    }
  })
  it('omits the paid amount for a non-ILS purchase', () => {
    const p = purchase({ originalCurrency: 'USD' })
    expect(savingsBasket(p, record(p), [catalogPlace])?.items[0]).not.toHaveProperty('paidMinor')
  })
  it('ignores demo, synthetic and barcode-less purchases', () => {
    const p = purchase()
    expect(savingsBasket(p, undefined, [catalogPlace])).toBeNull()
    expect(savingsBasket(p, record(p, { synthetic: true }), [catalogPlace])).toBeNull()
    expect(savingsBasket(p, record(p, { identification: undefined }), [catalogPlace])).toBeNull()
    expect(savingsBasket(p, record(p, { identification: { method: 'demo', syntheticCatalog: true, identity: { gtin14: GTIN } as never } }), [catalogPlace])).toBeNull()
    expect(savingsBasket(purchase({ provenance: undefined }), record(p), [catalogPlace])).toBeNull()
  })
})

describe('camera offset beside the purchase panel', () => {
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
  it('puts the store above a phone bottom sheet', async () => {
    const { offsetBesidePanel } = await import('./savings-camera')
    expect(offsetBesidePanel(rect(16, 204, 358, 556), { width: 390, height: 844 })).toEqual([0, Math.round((64 + 204) / 2 - 422)])
  })
  it('puts the store beside a desktop side panel, LTR and RTL', async () => {
    const { offsetBesidePanel } = await import('./savings-camera')
    expect(offsetBesidePanel(rect(790, 82, 470, 798), { width: 1280, height: 900 })).toEqual([395 - 640, 0])
    expect(offsetBesidePanel(rect(20, 82, 470, 798), { width: 1280, height: 900 })).toEqual([885 - 640, 0])
    expect(offsetBesidePanel(null, { width: 1280, height: 900 })).toEqual([0, 0])
  })
})
