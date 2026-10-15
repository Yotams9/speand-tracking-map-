import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as context } from '../../data/spendscape-fixtures'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from './session-purchase-domain'
import { legacyMainGraph, readLegacyMain, validateLegacyMain, type LegacyMainLedger } from './session-purchase-storage'

export function legacyFixture(): LegacyMainLedger {
  const saved = saveReviewedPurchase(emptySessionLedger(), 'fixture', { ...blankReview(), source: 'manual', provenance: 'user-reviewed', merchantId: context.merchants[0].id, channel: 'online', date: '2026-10-02T10:15', currency: 'ILS', payment: 'cash', category: 'retail', amount: '12.50' }, context, [])
  if (saved.result.code !== 'saved') throw new Error('synthetic fixture')
  return { version: 1, nextSequence: saved.ledger.nextSequence, records: structuredClone([...saved.ledger.records]), merchants: [], places: [] }
}
describe('strict main localStorage compatibility', () => {
  it('preserves every original ID, financial fact, timestamp and provenance without writes', () => {
    const value = legacyFixture(), before = JSON.stringify(value)
    expect(validateLegacyMain(value,context)).toEqual(value)
    expect(readLegacyMain(before,context)).toEqual(value)
    expect(JSON.stringify(value)).toBe(before)
    expect(readLegacyMain(null,context)).toBeNull()
    delete value.merchants; delete value.places
    expect(validateLegacyMain(value,context)).toEqual(value)
  })
  it.each(['{','null','[]','',JSON.stringify({ version: 2, records: [] })])('fails closed for corrupt or unsupported storage %s', raw => {
    expect(() => readLegacyMain(raw,context)).toThrow('legacy-ledger-invalid')
  })
  it('rejects the complete ledger, never salvages invalid rows or colliding IDs', () => {
    for (const mutate of [
      (v: any) => { v.records.push(v.records[0]) },
      (v: any) => { v.records[0].purchase.originalAmount = -1 },
      (v: any) => { v.records[0].purchase.timestamp = '2026-02-30T10:15:00Z' },
      (v: any) => { v.records[0].purchase.placeId = 'missing' },
      (v: any) => { v.records[0].evidence.purchaseId = 'wrong' },
      (v: any) => { v.records[0].purchase.provenance = 'confirmed-by-provider' },
      (v: any) => { v.records[0].image = 'forbidden' },
      (v: any) => { v.records[0].purchase.fx.extra = 'secret' },
      (v: any) => { v.nextSequence = 1 },
      (v: any) => { v.records = new Array(2001) },
    ]) { const v = legacyFixture(); mutate(v); expect(() => validateLegacyMain(v,context)).toThrow('legacy-ledger-invalid') }
  })
  it('namespaces VIEW identifiers deterministically without losing collisions', () => {
    const value = legacyFixture(), first = legacyMainGraph(context,value), second = legacyMainGraph(context,value)
    expect(first).toEqual(second)
    expect(first.records[0].purchase.id).toBe(`legacy_main:${value.records[0].purchase.id}`)
    expect(first.records[0].evidence.purchaseId).toBe(first.records[0].purchase.id)
    expect(value.records[0].purchase.id).toBe('session_purchase_manual_01')
  })
})
