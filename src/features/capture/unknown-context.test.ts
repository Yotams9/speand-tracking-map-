import {describe, expect, it} from 'vitest'
import {demoDraftForSource} from './capture-domain'
import {createFixtureSpendscapeRepository} from '../../data/spendscape-repository'
import {derivePurchaseAnalytics} from '../../data/spendscape-analytics'
import {receiptToReviewDraft, prepareReceiptReview} from './receipt-review-adapter'
import {blankReview, reviewFromDemo, emptySessionLedger, saveReviewedPurchase, undoSessionPurchase} from './session-purchase-domain'
import {emptyLocalPurchases, restoredLedger, validateLocalPurchases} from '../local-purchases/local-purchase-store'
const data=await createFixtureSpendscapeRepository().loadSnapshot()
const draft = () => {
  const d = receiptToReviewDraft({merchantName:'Fictional unknown-context store',address:'Fictional street',date:'29/02/2024',time:'09:07',currency:'ש״ח',finalAmount:'10.05',lines:[{name:'מוצר בדוי',quantity:'2',unit:'item',unitPrice:'5.00',lineAmount:'10.00'}]})
  Object.assign(d.review,{date:'2024-02-29T09:07',payment:'unknown',category:'unknown',directoryIntent:{merchant:{name:'Fictional unknown-context store',category:'unknown',separate:false}}})
  return d
}
const saved = () => {
  const prepared=prepareReceiptReview(draft(),data)
  if(!prepared.ready) throw new Error('synthetic-not-ready')
  const s=saveReviewedPurchase(emptySessionLedger(),'synthetic-unknown',prepared.input,data,data.purchases)
  expect(s.result.code).toBe('saved')
  return {ledger:s.ledger, disk:{...emptyLocalPurchases(),directory:s.ledger.directory,records:s.ledger.records,nextSequence:s.ledger.nextSequence}}
}
describe('explicit unknown context',()=>{
  it('requires an explicit choice; does not prefill invented context',()=>{const d=receiptToReviewDraft(draft().observations); expect(d.review.payment).toBe('');expect(d.review.category).toBe('');expect(prepareReceiptReview(d,data).ready).toBe(false)})
  it('saves unknown payment/categories without rewriting observed product values',()=>{const {disk}=saved();const p=disk.records[0].purchase;expect(p).toMatchObject({paymentMode:'unknown',category:'unknown',channel:'unknown',placeId:null,originalAmount:10.05});expect(p.items[0]).toMatchObject({quantity:2,unitPrice:5,lineTotal:10});expect(disk.directory.places).toEqual([]);expect(disk.directory.merchants[0].category).toBe('unknown');expect(validateLocalPurchases(JSON.parse(JSON.stringify(disk)),data)).toEqual(disk)})
  it('retains original observations separately',()=>{const d=draft(),before=structuredClone(d.observations);prepareReceiptReview(d,data);expect(d.observations).toEqual(before)})
  it.each(['','wire',null,12])('rejects invalid payment %s',payment=>{const d=draft();(d.review as any).payment=payment;expect(prepareReceiptReview(d,data).ready).toBe(false)})
  it.each(['','other',null,12])('rejects invalid category %s',category=>{const d=draft();(d.review as any).category=category;expect(prepareReceiptReview(d,data).ready).toBe(false)})
  it('still blocks unresolved units, invalid dates, arithmetic and excessive discounts',()=>{for(const mutate of [(d:ReturnType<typeof draft>)=>{d.review.lines[0].unit='' as never},(d:ReturnType<typeof draft>)=>{d.review.date='2024-02-30T09:07'},(d:ReturnType<typeof draft>)=>{d.review.lines[0].printedAmount='9.99'},(d:ReturnType<typeof draft>)=>{d.review.lines[0].discount='11'}]){const d=draft();mutate(d);expect(prepareReceiptReview(d,data).ready).toBe(false)}})
  it('preserves duplicate and Undo semantics',()=>{const {ledger,disk}=saved();const p=prepareReceiptReview(draft(),data);if(!p.ready)throw 0;const input={...p.input,directoryIntent:undefined,merchantId:disk.records[0].purchase.merchantId};const context={...data,merchants:[...data.merchants,...disk.directory.merchants]};expect(saveReviewedPurchase(ledger,'another',input,context,data.purchases).result.code).toBe('duplicate');expect(undoSessionPurchase(ledger)).toMatchObject({records:[],directory:{merchants:[],places:[]}});expect(restoredLedger(disk).undoId).toBeNull()})
  it('includes unknown category in analytics without treating unknown payment as cash',()=>{const {disk}=saved();const p=disk.records[0].purchase;expect(derivePurchaseAnalytics([p],[]).categories.find(c=>c.key==='unknown')).toMatchObject({purchaseCount:1,totalBaseAmountIls:10.05});expect(p.paymentMode).not.toBe('manual')})
  it.each([1,2,3])('migrates validated v%s known records in memory only',version=>{const l=saveReviewedPurchase(emptySessionLedger(),'legacy',reviewFromDemo(demoDraftForSource('receipt')!,'he'),data,data.purchases).ledger;const old={...emptyLocalPurchases(),records:l.records,nextSequence:l.nextSequence};let legacy:any={...old,version};if(version<3)delete legacy.directory;const before=JSON.stringify(legacy);const next=validateLocalPurchases(legacy,data);expect(next.version).toBe(4);expect(next.records).toEqual(legacy.records);expect(JSON.stringify(legacy)).toBe(before)})
  it.each([1,2,3])('does not reinterpret unknown context in old v%s envelopes',version=>{const {disk}=saved();expect(()=>validateLocalPurchases({...disk,version},data)).toThrow('invalid')})
  it('fails closed on future versions and extra data',()=>{const {disk}=saved();expect(()=>validateLocalPurchases({...disk,version:5},data)).toThrow('invalid');expect(()=>validateLocalPurchases({...disk,photo:'forbidden'},data)).toThrow('invalid')})
})

// Independent migration controls: start with known context and real domain
// records, never an edited historical reservation or an ignored fixture file.
function legacyEnvelope(version: 1 | 2 | 3) {
  const place = data.places[0]
  const discounted = version !== 1
  const input = {
    ...blankReview(), source: 'receipt' as const, merchantId: place.merchantId,
    placeId: place.id, channel: 'physical' as const, date: '2024-02-29T09:07',
    currency: 'ILS' as const, payment: 'cash' as const, category: 'groceries' as const,
    amount: discounted ? '8.05' : '10.05',
    lines: discounted
      ? [{name:'Fictional free item',quantity:'1',unit:'item' as const,price:'10',discount:'10'},
        {name:'Fictional partial discount',quantity:'1',unit:'item' as const,price:'10',discount:'2'}]
      : [{name:'Fictional ordinary item',quantity:'1',unit:'item' as const,price:'10'}],
    ...(version === 3 ? {merchantId:'', placeId:'', directoryIntent:{
      merchant:{name:'Fictional migration store', category:'groceries' as const,separate:false},
      place:{branch:'Fictional branch',city:'Fictional city',country:'Fictional country',address:'Fictional road',longitude:'34.75',latitude:'32.1',confirmed:true,separate:false},
    }} : {}),
  }
  const result = saveReviewedPurchase(emptySessionLedger(), 'migration-control', input, data, data.purchases)
  expect(result.result.code).toBe('saved')
  const cases = data.smartInboxCases.filter(c => c.material).slice(0,2)
  const decisions = cases.map((c,i) => i === 0
    ? {caseId:c.id,status:'resolved' as const,placeId:c.candidates[0].placeId}
    : {caseId:c.id,status:'deferred' as const})
  return {version, revision:37, records:result.ledger.records,nextSequence:result.ledger.nextSequence,decisions,
    ...(version === 3 ? {directory:result.ledger.directory} : {})}
}
describe('independent legacy envelope preservation', () => {
  it.each([1,2,3] as const)('v%s preserves exact records, decisions and revision before any write', version => {
    const legacy = legacyEnvelope(version), before = JSON.stringify(legacy)
    const migrated = validateLocalPurchases(legacy, data)
    expect(migrated).toEqual({...legacy,version:4,directory:legacy.directory ?? {merchants:[],places:[]}})
    expect(JSON.stringify(legacy)).toBe(before)
    expect(migrated.records[0].purchase.originalAmount).toBe(version === 1 ? 10.05 : 8.05)
    expect(migrated.records[0].purchase.items.reduce((n,i)=>n+i.lineTotal,0)).toBe(version === 1 ? 10 : 8)
    if (version !== 1) expect(migrated.records[0].purchase.items[0]).toMatchObject({lineTotal:0,discountMinor:1000,unitPrice:10})
    if (version === 3) {
      expect(migrated.directory.merchants[0].id).toBe(legacy.records[0].purchase.merchantId)
      expect(migrated.directory.places[0].id).toBe(legacy.records[0].purchase.placeId)
    }
  })
  it.each([1,2,3] as const)('v%s rejects a corrupt member without salvaging the rest', version => {
    const legacy = legacyEnvelope(version)
    for (const mutate of [
      (raw: any) => {raw.records[0].purchase.paymentMode='wire'},
      (raw: any) => {raw.records[0].purchase.category='other'},
      (raw: any) => {raw.records[0].purchase.items[0].lineTotal=99},
      (raw: any) => {raw.records.push(structuredClone(raw.records[0]))},
      (raw: any) => {raw.decisions[0].placeId='forged-place'},
      (raw: any) => {raw.nextSequence=1},
    ]) {
      const raw=structuredClone(legacy);mutate(raw);const before=JSON.stringify(raw)
      expect(()=>validateLocalPurchases(raw,data)).toThrow('invalid')
      expect(JSON.stringify(raw)).toBe(before)
    }
  })
  it('rejects unknown merchant categories in otherwise valid v3 separately from purchase context', () => {
    const legacy=legacyEnvelope(3)
    legacy.directory!.merchants[0].category='unknown';legacy.directory!.places[0].category='unknown'
    expect(validateLocalPurchases({...legacy,version:4},data).records[0].purchase.paymentMode).toBe('cash')
    expect(()=>validateLocalPurchases(legacy,data)).toThrow('invalid')
  })
  it.each(['currency','timestamp','unit'] as const)('unknown context cannot bypass required %s validation', field => {
    const {disk}=saved()
    if(field==='currency') (disk.records[0].purchase as any).originalCurrency='unknown'
    if(field==='timestamp') disk.records[0].purchase.timestamp='2024-02-30T09:07:00.000Z'
    if(field==='unit') (disk.records[0].purchase.items[0] as any).unit='unknown'
    expect(()=>validateLocalPurchases(disk,data)).toThrow('invalid')
  })
})
