import { describe, expect, it } from 'vitest'
import { createFixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from '../capture/session-purchase-domain'
import { resolvePurchaseLocation, undoPurchaseLocation, type PurchaseLocationIntent } from './purchase-location'
import { emptyLocalPurchases, restoredLedger, validateLocalPurchases } from './local-purchase-store'
import { candidatePoint,pointInputs, normalizeGeoapify } from './address-search'
import { composeDirectory } from './local-directory'
const data = await createFixtureSpendscapeRepository().loadSnapshot()
function saved(channel: 'unknown' | 'online' = 'unknown') {
  const result = saveReviewedPurchase(emptySessionLedger(), 'fictional', {
    ...blankReview(), source: 'receipt', channel, date: '2024-02-29T09:07', currency: 'ILS', payment: 'unknown', category: 'unknown', amount: '8.05',
    lines: [{ name: 'מוצר בדוי חינם', quantity: '1', unit: 'item', price: '10', discount: '10' }, { name: 'Fictional paid', quantity: '2', unit: 'item', price: '5', discount: '2' }],
    directoryIntent: { merchant: { name: 'Fictional merchant', category: 'unknown', separate: false } },
  }, data, data.purchases)
  if (result.result.code !== 'saved') throw new Error('fixture-invalid')
  return result.ledger
}
const branch = (): PurchaseLocationIntent => ({ kind: 'branch', branch: 'Fictional branch', city: 'Fictional city', country: 'Fictional country', address: 'Fictional street 12', longitude: '34.75', latitude: '32.1', method: 'map-selection', confirmed: true })
const disk = (l: ReturnType<typeof saved>) => ({ ...emptyLocalPurchases(), directory: l.directory, records: l.records, nextSequence: l.nextSequence })
const apply = (l = saved(), intent = branch()) => resolvePurchaseLocation(l,l.records[0].purchase.id,intent,data)
function facts(p: ReturnType<typeof saved>['records'][number]['purchase']) { const { placeId: _p, channel: _c, resolution: _r, ...rest } = p; return rest }
describe('confirmed local purchase place update', () => {
  it('updates in place preserving facts, discounts, zero net, IDs and provenance', () => {
    const before = saved(), snapshot = structuredClone(before), result = apply(before)
    expect(result.code).toBe('updated');expect(before).toEqual(snapshot)
    expect(result.ledger.records).toHaveLength(1)
    expect(result.ledger.records[0].purchase).toMatchObject({channel:'physical',resolution:'confirmed',placeId:'local_place_2',originalAmount:8.05})
    expect(facts(result.ledger.records[0].purchase)).toEqual(facts(before.records[0].purchase))
    expect(result.ledger.records[0].evidence).toEqual(before.records[0].evidence)
    expect(result.ledger.records[0].purchase.items[0]).toMatchObject({lineTotal:0,discountMinor:1000})
    expect(result.ledger.records[0].purchase.items.reduce((n,i)=>n+i.lineTotal,0)).toBe(8)
    expect(validateLocalPurchases(disk(result.ledger),data)).toEqual(disk(result.ledger))
    expect(restoredLedger(validateLocalPurchases(JSON.parse(JSON.stringify(disk(result.ledger))),data)).records).toEqual(result.ledger.records)
  })
  it('explicit reuse creates no directory record or sequence increment', () => {
    const first=apply().ledger
    const second=saveReviewedPurchase(first,'other',{...blankReview(),source:'manual',merchantId:first.records[0].purchase.merchantId,channel:'unknown',date:'2024-03-01T09:07',currency:'ILS',payment:'unknown',category:'unknown',amount:'4',lines:[]},composeDirectory(data,first.directory),data.purchases).ledger
    const r=resolvePurchaseLocation(second,second.records[1].purchase.id,{kind:'reuse',placeId:first.records[0].purchase.placeId!,confirmed:true},data)
    expect(r.code).toBe('updated');expect(r.ledger.directory.places).toHaveLength(1);expect(r.ledger.nextSequence).toBe(second.nextSequence)
    expect(validateLocalPurchases(disk(r.ledger),data).records).toHaveLength(2)
    expect(resolvePurchaseLocation(r.ledger,second.records[1].purchase.id,{kind:'reuse',placeId:first.records[0].purchase.placeId!,confirmed:true},data)).toMatchObject({code:'unchanged',ledger:r.ledger})
  })
  it('rejects duplicate branch, point or address instead of multiplying pins', () => {
    const first=apply().ledger
    for(const mutate of [()=>{},(p:any)=>{p.branch='Other'},(p:any)=>{p.branch='Other';p.longitude='35';p.latitude='32.3'}]){const p=branch();mutate(p);expect(apply(first,p)).toMatchObject({code:'invalid',errors:{'place-separate':'duplicate'}})}
  })
  it('rejects another merchant place, fixture purchase, online and missing purchase', () => {
    const l=saved();expect(apply(l,{kind:'reuse',placeId:data.places[0].id,confirmed:true}).code).toBe('invalid')
    for(const id of [data.purchases[0].id,'missing'])expect(resolvePurchaseLocation(l,id,branch(),data).code).toBe('protected')
    expect(apply(saved('online')).code).toBe('protected')
  })
  it.each(['longitude','latitude','branch','city','country','confirmed','method'] as const)('rejects invalid %s without mutation', key => {
    const l=saved(),b:any=branch();b[key]=key==='confirmed'?false:key==='method'?'geocoder':key==='longitude'?'181':key==='latitude'?'91':''
    expect(apply(l,b).code).toBe('invalid');expect(l.directory.places).toHaveLength(0)
  })
  it('refuses unexpected metadata, malformed structures and accessors', () => {
    const l=saved();for(const value of [null,{},[],{...branch(),image:'secret'}, {...branch(),address:'secret\nline'}, {kind:'reuse',placeId:'x',confirmed:'true'}])expect(resolvePurchaseLocation(l,l.records[0].purchase.id,value,data).code).toBe('invalid')
    const b:any=branch();Object.defineProperty(b,'kind',{get(){throw new Error('getter-called')}});expect(resolvePurchaseLocation(l,l.records[0].purchase.id,b,data).code).toBe('invalid')
  })
  it('reversible updates restore pruned old place and preserve monotonic IDs', () => {
    const first=apply().ledger,b=branch();if(b.kind==='branch'){b.branch='Second';b.address='Other street';b.longitude='35'}
    const second=apply(first,b).ledger;expect(second.directory.places.map(p=>p.id)).toEqual(['local_place_3'])
    const undone=undoPurchaseLocation(second,{before:first,after:second})!;expect(undone.records).toEqual(first.records);expect(undone.directory).toEqual(first.directory);expect(undone.nextSequence).toBe(4);expect(validateLocalPurchases(disk(undone),data)).toEqual(disk(undone))
    expect(undoPurchaseLocation({...second},{before:first,after:second})).toBeNull()
  })
  it('map provenance is valid only in v4; legacy manual places still migrate read-only', () => {
    const mapped=apply().ledger;expect(()=>validateLocalPurchases({...disk(mapped),version:3},data)).toThrow('invalid')
    const old=saved();const input:any=branch();input.method='manual-coordinates';const l=apply(old,input).ledger
    // Known context is necessary for a legacy v3 envelope.
    const d:any=disk(l);d.directory.merchants[0].category='groceries';d.directory.places[0].category='groceries';d.records[0].purchase.category='groceries';d.records[0].purchase.paymentMode='cash';d.version=3;delete d.legacyMain
    const before=JSON.stringify(d);expect(validateLocalPurchases(d,data).version).toBe(5);expect(JSON.stringify(d)).toBe(before)
  })
})

describe('confirmed address-search provenance',()=>{
 const searchBranch=(precision='building',match='full',pointAdjusted=false)=>({...branch(),method:'address-search',addressSearch:{provider:'geoapify',precision,match,pointAdjusted}})
 it('preserves confirmed candidate provenance and independent purchase facts on reload',()=>{const before=saved(),result=resolvePurchaseLocation(before,before.records[0].purchase.id,searchBranch(),data);expect(result.code).toBe('updated');expect(facts(result.ledger.records[0].purchase)).toEqual(facts(before.records[0].purchase));expect(validateLocalPurchases(disk(result.ledger),data).directory.places[0].addressSearch).toEqual(searchBranch().addressSearch);expect(undoPurchaseLocation(result.ledger,{before,after:result.ledger})!.directory).toEqual(before.directory)})
 it('does not let street/city/partial matches become unadjusted store points',()=>{const before=saved();for(const intent of [searchBranch('street'),searchBranch('city'),searchBranch('building','partial')])expect(resolvePurchaseLocation(before,before.records[0].purchase.id,intent,data)).toMatchObject({code:'invalid',ledger:before,errors:{location:'adjust-point'}});expect(resolvePurchaseLocation(before,before.records[0].purchase.id,searchBranch('street','partial',true),data).code).toBe('updated')})
 it('rejects arbitrary metadata, absent provenance and coarse disk bypass',()=>{const before=saved();for(const intent of [{...branch(),method:'address-search'},{...searchBranch(),addressSearch:{...searchBranch().addressSearch,raw:'secret'}}])expect(resolvePurchaseLocation(before,before.records[0].purchase.id,intent,data).code).toBe('invalid');const r=resolvePurchaseLocation(before,before.records[0].purchase.id,searchBranch(),data);const d:any=disk(r.ledger);d.directory.places[0].addressSearch.precision='city';expect(()=>validateLocalPurchases(d,data)).toThrow('invalid')})
 it('legacy v3 cannot smuggle new address provenance into manual records',()=>{const r=resolvePurchaseLocation(saved(),saved().records[0].purchase.id,{...searchBranch(),method:'manual-coordinates'},data);const d:any=disk(r.ledger);d.version=3;d.directory.merchants[0].category='groceries';d.directory.places[0].category='groceries';d.records[0].purchase.category='groceries';d.records[0].purchase.paymentMode='cash';expect(()=>validateLocalPurchases(d,data)).toThrow('invalid')})
})

it.each([[34.82341302945888,32.10094496732003],[0.00000001,-0.00000001]])('saves a confirmed candidate through the same strict coordinate validator: %j',(lon,lat)=>{const result=normalizeGeoapify({results:[{formatted:'Fictional street 12',city:'Fictional city',country:'Fictional country',lon,lat,result_type:'building',rank:{match_type:'full_match'},datasource:{sourcename:'openstreetmap'}}]});if(result.status!=='results')throw 0;const c=result.candidates[0],p=candidatePoint(c),before=saved(),r=resolvePurchaseLocation(before,before.records[0].purchase.id,{...branch(),address:c.address,...pointInputs(p),method:'address-search',addressSearch:c.provenance},data);expect(r.code).toBe('updated');expect(validateLocalPurchases(disk(r.ledger),data).directory.places[0].coordinates).toEqual(p);expect(facts(r.ledger.records[0].purchase)).toEqual(facts(before.records[0].purchase))})
