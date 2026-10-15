import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as history } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import { blankReview, emptySessionLedger, saveReviewedPurchase, undoSessionPurchase } from './session-purchase-domain'
import { composeDirectory } from '../local-purchases/local-directory'
import { emptyLocalPurchases, validateLocalPurchases } from '../local-purchases/local-purchase-store'

const context = { ...history, source: { adapter: 'fixture' as const, classification: 'synthetic' as const, version: history.fixtureVersion } }
describe('integrated custom store directory', () => {
  it.each(['online','unknown','physical'] as const)('preserves %s stores through canonical persistence and Undo', channel => {
    const input = { ...blankReview(), channel, date:'2026-10-02T10:15',currency:'ILS' as const,payment:'cash' as const,category:'groceries' as const,amount:'12.50',directoryIntent: { merchant: { name:'Synthetic new merchant',category:'groceries' as const,separate:false }, ...(channel === 'physical' ? { place:{branch:'Synthetic branch',address:'Synthetic 1',city:'Test city',country:'Test country',longitude:'34.77',latitude:'32.08',confirmed:true,separate:false} } : {}) } }
    const result = saveReviewedPurchase(emptySessionLedger(),'synthetic-op',input,context,[])
    expect(result.result.code).toBe('saved')
    const ledger = result.ledger, graph = composeDirectory(context,ledger.directory)
    const saved = validateLocalPurchases({ ...emptyLocalPurchases(),records:ledger.records,directory:ledger.directory,nextSequence:ledger.nextSequence },context)
    expect(saved.records).toEqual(ledger.records)
    const pins = buildPlaceFeatureCollection(graph.places,saved.records.map(r => r.purchase))
    expect(pins.features).toHaveLength(channel === 'physical' ? 1 : 0)
    expect(undoSessionPurchase(ledger).directory).toEqual({merchants:[],places:[]})
  })
})
