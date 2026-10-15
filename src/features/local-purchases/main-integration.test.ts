import { describe, expect, it } from 'vitest'
import { nativeFixture, legacyFixture, integrationContext as context } from '../../../qa/main-integration-fixtures'
import { legacyMainGraph, validateLegacyMain } from '../capture/session-purchase-storage'
import { emptyRestoreDestination, validateLocalPurchases } from './local-purchase-store'
import { exportPurchaseBackup, inspectPurchaseBackup } from './purchase-backup'
import { composeUserGraph } from '../../data/spendscape-user'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import { derivePurchaseAnalytics } from '../../data/spendscape-analytics'

describe('two-ledger integration, collisions and backup', () => {
  it('migrates actual v4 in memory and retains every fact and decision', () => {
    const { legacyMain: _archive,...rest } = nativeFixture
    const v4 = {...rest,version:4}, before = JSON.stringify(v4)
    const clean=validateLocalPurchases(v4,context)
    expect(clean).toEqual({...nativeFixture,version:5,legacyMain:null})
    expect(JSON.stringify(v4)).toBe(before)
  })
  it('preserves colliding purchase IDs independently, sharing only identical known place references', () => {
    const value={...nativeFixture,legacyMain:legacyFixture}, before=JSON.stringify(value)
    const clean=validateLocalPurchases(value,context), legacy=legacyMainGraph(context,clean.legacyMain!)
    const graph=composeUserGraph(context,clean.directory,[...clean.records,...legacy.records])
    expect(graph.purchases.map(p=>p.id)).toEqual(['session_purchase_receipt_01','legacy_main:session_purchase_receipt_01'])
    expect(graph.purchases.map(p=>p.originalAmount)).toEqual([12.4,12.5])
    expect(buildPlaceFeatureCollection(graph.places,graph.purchases).features).toHaveLength(1)
    expect(derivePurchaseAnalytics(graph.purchases,graph.records.map(r=>r.evidence)).totalBaseAmountIls).toBe(24.9)
    expect(JSON.stringify(value)).toBe(before)
    expect(validateLocalPurchases(clean,context)).toEqual(clean)
    expect(emptyRestoreDestination(clean)).toBe(false)
  })
  it('round trips both ledgers with original IDs, timestamps and unpromoted place metadata',async()=>{
    const source={...nativeFixture,legacyMain:legacyFixture}
    const text=await exportPurchaseBackup(source,context)
    const preview=await inspectPurchaseBackup(text,context)
    expect(preview.purchases).toBe(2);expect(preview.data).toEqual(source)
    expect(preview.data.legacyMain!.records[0].purchase.id).toBe(source.records[0].purchase.id)
    expect(preview.data.legacyMain!.places).toEqual([])
    expect(preview.data.records[0].purchase.items[0].lineTotal).toBe(12.5)
    expect(preview.data.records[0].purchase.originalAmount).toBe(12.4)
  })
  it('preserves added main stores and their original IDs without inventing confirmation provenance',()=>{
    const value=structuredClone(legacyFixture),m={id:'device_merchant_01',name:{en:'Fictional legacy',he:'Fictional legacy'},category:'groceries' as const}
    const p={...context.places[0],id:'device_place_01',merchantId:m.id,name:m.name,category:m.category}
    value.merchants=[m];value.places=[p];value.records[0].purchase.merchantId=m.id;value.records[0].purchase.placeId=p.id
    expect(validateLegacyMain(value,context)).toEqual(value)
    const graph=legacyMainGraph(context,value)
    expect(graph.places[0].id).toBe('legacy_main:device_place_01')
    expect(graph.places[0]).not.toHaveProperty('locationMethod')
    expect(graph.places[0]).not.toHaveProperty('source')
  })
})
it('preserves two independently bounded ledgers even when their combined size exceeds the old single-ledger ceiling',async()=>{
 const { reviewedRecord }=await import('../capture/session-purchase-domain')
 const p=nativeFixture.records[0].purchase
 const records=Array.from({length:100},(_,i)=>reviewedRecord({source:'receipt',provenance:'user-reviewed',merchantId:p.merchantId,placeId:p.placeId!,channel:'physical',date:'2024-03-01T10:15',currency:'ILS',payment:'cash',category:'groceries',amount:'50',baseAmount:'',lines:Array.from({length:50},()=>({name:'Fictional '+ 'x'.repeat(90),quantity:'1',unit:'item',price:'1'}))},i+1,context))
 const legacy={version:1 as const,nextSequence:101,records:structuredClone(records),merchants:[],places:[]}
 const value={...nativeFixture,records,nextSequence:101,legacyMain:legacy}
 expect(JSON.stringify(value).length).toBeGreaterThan(2_000_000)
 expect(JSON.stringify({...value,legacyMain:null}).length).toBeLessThan(2_000_000)
 expect(JSON.stringify(legacy).length).toBeLessThan(2_000_000)
 expect(validateLocalPurchases(value,context)).toEqual(value)
})


describe('legacy weighted rounding compatibility', () => {
  const cases = [
    ['0.25', '0.58', '0.15'], ['0.29', '0.5', '0.15'],
    ['0.45', '0.7', '0.32'], ['0.50', '0.29', '0.15'],
    ['1.00', '0.5', '0.50'],
  ]
  it.each(cases)('retains main-compatible half-up facts %s × %s = %s', async (price, quantity, total) => {
    const value = structuredClone(legacyFixture)
    const p = value.records[0].purchase
    p.items = [{ ...p.items[0], unit: 'kg', quantity: Number(quantity), unitPrice: Number(price), lineTotal: Number(total) }]
    p.originalAmount = Number(total)
    const before = JSON.stringify(value)
    expect(validateLegacyMain(value, context)).toEqual(value)
    const source = { ...nativeFixture, legacyMain: value }
    expect(validateLocalPurchases(source, context)).toEqual(source)
    expect((await inspectPurchaseBackup(await exportPurchaseBackup(source, context), context)).data).toEqual(source)
    expect(JSON.stringify(value)).toBe(before)
    for (const wrong of [Number(total) - 0.01, Number(total) + 0.01]) {
      const invalid = structuredClone(value)
      invalid.records[0].purchase.items[0].lineTotal = Number(wrong.toFixed(2))
      invalid.records[0].purchase.originalAmount = Number(wrong.toFixed(2))
      expect(() => validateLegacyMain(invalid, context)).toThrow('legacy-ledger-invalid')
    }
  })
  it('still rejects native altered printed lines and malformed legacy precision', () => {
    const native = structuredClone(nativeFixture)
    native.records[0].purchase.items[0].lineTotal += 0.01
    expect(() => validateLocalPurchases(native, context)).toThrow()
    const legacy = structuredClone(legacyFixture)
    legacy.records[0].purchase.items[0].lineTotal = 12.501
    expect(() => validateLegacyMain(legacy, context)).toThrow()
  })
})
