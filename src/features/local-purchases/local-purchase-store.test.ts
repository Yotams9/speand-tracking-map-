import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as data } from '../../data/spendscape-fixtures'
import { demoDraftForSource } from '../capture/capture-domain'
import { emptySessionLedger, reviewFromDemo, saveReviewedPurchase } from '../capture/session-purchase-domain'
import { emptyLocalPurchases, restoredLedger, validateLocalPurchases, validateLocalPurchaseWrite } from './local-purchase-store'
const receipt = () => saveReviewedPurchase(emptySessionLedger(), 'op', reviewFromDemo(demoDraftForSource('receipt')!, 'he'), data, data.purchases).ledger
const disk = () => { const l = receipt(); return { ...emptyLocalPurchases(), records: l.records, nextSequence: l.nextSequence } }
describe('local purchase boundary', () => {
  it('rehydrates reviewed bilingual receipt with exact identities and no Undo or consumed operations', () => {
    const stored = validateLocalPurchases(JSON.parse(JSON.stringify(disk())), data)
    expect(stored).toEqual(disk())
    expect(restoredLedger(stored)).toMatchObject({ undoId: null, consumed: [], nextSequence: 2 })
    expect(stored.records[0].demoProductIds).toContain('demo_sourdough')
  })
  it('retains explicit foreign ILS amount and unpinned online channel', () => {
    const input = { ...reviewFromDemo(demoDraftForSource('receipt')!, 'en'), provenance: 'user-reviewed' as const, source: 'manual' as const, currency: 'USD' as const, baseAmount: '381.17', channel: 'online' as const, placeId: '', lines: [] }
    const l = saveReviewedPurchase(emptySessionLedger(), 'op', input, data, data.purchases).ledger
    const stored = validateLocalPurchases({ ...emptyLocalPurchases(), records: l.records, nextSequence: l.nextSequence }, data)
    expect(stored.records[0].purchase.fx.reportedBaseAmountIls).toBe(381.17)
    expect(stored.records[0].purchase.placeId).toBeNull()
  })
  it.each(['version', 'revision', 'nextSequence', 'records', 'decisions'])('fails closed on malformed %s', key => {
    expect(() => validateLocalPurchases({ ...disk(), [key]: 'bad' }, data)).toThrow('invalid')
  })
  it('rejects unexpected fields, corrupted arithmetic, identities and duplicate IDs', () => {
    expect(() => validateLocalPurchases({ ...disk(), image: 'private' }, data)).toThrow('invalid')
    const d = structuredClone(disk()); d.records[0].purchase.originalAmount = 1
    expect(() => validateLocalPurchases(d, data)).toThrow('invalid')
    const e = structuredClone(disk()); e.records[0].evidence.label.en = 'forged'
    expect(() => validateLocalPurchases(e, data)).toThrow('invalid')
    const media = structuredClone(disk()) as any; media.records[0].purchase.items[0].label.image = 'forbidden'
    expect(() => validateLocalPurchases(media, data)).toThrow('invalid')
    const ids = structuredClone(disk()) as any; ids.records[0].demoProductIds[0] = { image: 'forbidden' }
    expect(() => validateLocalPurchases(ids, data)).toThrow('invalid')
    const f = disk(); f.records = [...f.records, f.records[0]]
    expect(() => validateLocalPurchases(f, data)).toThrow('invalid')
    expect(() => validateLocalPurchases({ ...disk(), nextSequence: 1 }, data)).toThrow('invalid')
  })
  it('validates Inbox cases, unique decisions and canonical candidate place IDs', () => {
    const c = data.smartInboxCases.find(c => c.material)!
    const d = { ...disk(), decisions: [{ caseId: c.id, status: 'resolved', placeId: c.candidates[0].placeId }] }
    expect(validateLocalPurchases(d, data).decisions).toEqual(d.decisions)
    expect(() => validateLocalPurchases({ ...d, decisions: [...d.decisions, ...d.decisions] }, data)).toThrow('invalid')
    expect(() => validateLocalPurchases({ ...d, decisions: [{ caseId: c.id, status: 'resolved', placeId: 'fake' }] }, data)).toThrow('invalid')
    expect(() => validateLocalPurchases({ ...d, decisions: [{ caseId: c.id, status: 'other' }] }, data)).toThrow('invalid')
  })
  it('distinguishes prospective capacity rejection from invalid persisted data', () => {
    const count = { ...disk(), records: Array(1001).fill(disk().records[0]) }
    expect(() => validateLocalPurchaseWrite(count, data)).toThrow('capacity')
    expect(() => validateLocalPurchases(count, data)).toThrow('invalid')
    const size = { ...disk(), extra: 'x'.repeat(2_000_000) }
    expect(() => validateLocalPurchaseWrite(size, data)).toThrow('capacity')
    expect(() => validateLocalPurchases(size, data)).toThrow('invalid')
    expect(() => validateLocalPurchaseWrite({ ...disk(), nextSequence: 0 }, data)).toThrow('rejected')
    expect(validateLocalPurchaseWrite(disk(), data)).toEqual(disk())
  })

})

describe('P2C envelope compatibility and strict discounts', () => {
  it('migrates v1 in memory with all records, decisions, revisions and identities unchanged', () => {
    const c = data.smartInboxCases.find(c => c.material)!
    const old = { ...disk(), version: 1, revision: 12, decisions: [{ caseId: c.id, status: 'deferred' }] }
    const before = JSON.stringify(old)
    const migrated = validateLocalPurchases(old, data)
    expect(migrated).toEqual({ ...old, version: 2 })
    expect(JSON.stringify(old)).toBe(before)
    expect(validateLocalPurchases(migrated, data)).toEqual(migrated)
    expect(restoredLedger(migrated)).toMatchObject({ undoId: null, consumed: [] })
  })
  it('round trips 25 discounted lines and preserves foreign gross prices and reported ILS', () => {
    const input = { ...reviewFromDemo(demoDraftForSource('receipt')!, 'en'), provenance: 'user-reviewed' as const, currency: 'USD' as const, baseAmount: '1700.13', amount: '475', lines: Array.from({ length: 25 }, () => ({ name: 'Synthetic repeated item', quantity: '2', unit: 'item' as const, price: '10', discount: '1' })) }
    const ledger = saveReviewedPurchase(emptySessionLedger(), '25', input, data, data.purchases).ledger
    const record = { ...emptyLocalPurchases(), records: ledger.records, nextSequence: ledger.nextSequence }
    expect(validateLocalPurchases(JSON.parse(JSON.stringify(record)), data)).toEqual(record)
    expect(record.records[0].purchase.items[0]).toMatchObject({ unitPrice: 10, discountMinor: 100, lineTotal: 19 })
    expect(record.records[0].purchase.fx.reportedBaseAmountIls).toBe(1700.13)
  })
  it('rejects discount fields in v1 and unknown future versions without mutating input', () => {
    const old = structuredClone(disk()); old.records[0].purchase.items[0].discountMinor = 0
    for (const raw of [{ ...old, version: 1 }, { ...disk(), version: 3 }]) {
      const before = JSON.stringify(raw)
      expect(() => validateLocalPurchases(raw, data)).toThrow('invalid')
      expect(JSON.stringify(raw)).toBe(before)
    }
  })
  it('rejects forged net totals, malformed discount units and extra fields', () => {
    for (const discount of [-1, 999999, 0.5, '1', null, undefined, NaN]) {
      const d = structuredClone(disk()); (d.records[0].purchase.items[0] as any).discountMinor = discount
      expect(() => validateLocalPurchases(d, data)).toThrow('invalid')
    }
    const d = structuredClone(disk()); d.records[0].purchase.items[0].discountMinor = 100
    expect(() => validateLocalPurchases(d, data)).toThrow('invalid')
    expect(() => validateLocalPurchases({ ...disk(), photo: 'forbidden' }, data)).toThrow('invalid')
  })
})
