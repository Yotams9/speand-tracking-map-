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
