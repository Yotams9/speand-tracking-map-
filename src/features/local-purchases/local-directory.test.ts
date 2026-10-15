import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as data } from '../../data/spendscape-fixtures'
import { composeDirectory, denseArray, emptyDirectory, proposeDirectory, validateDirectory, type DirectoryIntent } from './local-directory'
export const fictionalIntent = (): DirectoryIntent => ({ merchant: { name: 'Fictional מכולת', category: 'groceries', separate: false }, place: { branch: 'Fictional north', city: 'Fictional city', country: 'Fictional country', address: 'Fictional street 12', longitude: '34.75', latitude: '32.10', confirmed: true, separate: false } })
describe('explicit local directory', () => {
  it('creates reviewed names with manual location provenance and no inferred online capability', () => {
    const p = proposeDirectory(fictionalIntent(), '', 'physical', 1, data)
    expect(p.errors).toEqual({}); expect(p.directory.merchants[0]).not.toHaveProperty('onlineOnly')
    expect(p.directory.places[0]).toMatchObject({ coordinates: [34.75,32.1], source: 'user-confirmed', locationMethod: 'manual-coordinates' })
    expect(validateDirectory(p.directory, data, 2)).toEqual(p.directory)
    expect(composeDirectory(data, p.directory).places).toHaveLength(13)
  })
  it('requires manual confirmation, geographic facts, ranges and matching merchant', () => {
    for (const change of [{ confirmed: false }, { latitude: '91' }, { longitude: '181' }, { longitude: 'NaN' }, { city: '' }, { country: '' }, { longitude: '1e2' }]) {
      const intent=fictionalIntent(); Object.assign(intent.place!,change)
      expect(Object.keys(proposeDirectory(intent,'','physical',1,data).errors).length).toBeGreaterThan(0)
    }
    expect(proposeDirectory({place:fictionalIntent().place},'missing','physical',1,data).errors).toHaveProperty('placeId')
    expect(proposeDirectory(fictionalIntent(),'','online',1,data).errors).toHaveProperty('placeId')
  })
  it('requires explicit separate-entity choice rather than fusing names or branches', () => {
    const intent=fictionalIntent(); intent.merchant!.name=data.merchants[0].name.en
    expect(proposeDirectory(intent,'','physical',1,data).errors).toHaveProperty('merchantSeparate')
    intent.merchant!.separate=true; expect(proposeDirectory(intent,'','physical',1,data).errors).toEqual({})
    const p=data.places[0], branch={...fictionalIntent().place!,branch:p.branch.en,longitude:String(p.coordinates[0]),latitude:String(p.coordinates[1])}
    expect(proposeDirectory({place:branch},p.merchantId,'physical',1,data).errors).toHaveProperty('place-separate')
    expect(proposeDirectory({place:{...branch,separate:true}},p.merchantId,'physical',1,data).errors).toEqual({})
  })
  it('fails closed on unknown keys, sparse/accessor arrays, invalid IDs/references and metadata', () => {
    const p=proposeDirectory(fictionalIntent(),'','physical',1,data).directory
    for (const mutate of [(d:any)=>d.merchants[0].id='fixture', (d:any)=>d.merchants.push(d.merchants[0]),(d:any)=>d.places[0].merchantId='missing',(d:any)=>d.places[0].coordinates=[NaN,2],(d:any)=>d.places[0].coordinates=[34,91],(d:any)=>d.places[0].address='bad\ntext',(d:any)=>d.places[0].image='secret',(d:any)=>d.merchants[0].onlineOnly=true,(d:any)=>d.places[0].locationMethod='gps']) {
      const d=structuredClone(p);mutate(d);expect(()=>validateDirectory(d,data,2)).toThrow()
    }
    expect(()=>validateDirectory(p,data,1)).toThrow()
    expect(denseArray(Array(1),2)).toBe(false)
    const a=['safe'];Object.defineProperty(a,'0',{get(){throw new Error('must-not-read')}});expect(denseArray(a,2)).toBe(false)
    const sparse=emptyDirectory();sparse.places=Array(1);expect(()=>validateDirectory(sparse,data,2)).toThrow()
    expect(proposeDirectory({...fictionalIntent(),image:'private'},'','physical',1,data).errors).toHaveProperty('directory')
  })
})

it('requires explicit reuse or separate confirmation for a reviewed address at the same merchant',()=>{
  const first=proposeDirectory(fictionalIntent(),'','physical',1,data),context=composeDirectory(data,first.directory)
  const intent={place:{...fictionalIntent().place!,branch:'Different fictional branch',longitude:'34.8'}}
  expect(proposeDirectory(intent,first.merchantId,'physical',2,context).errors).toHaveProperty('place-separate')
  intent.place.separate=true;expect(proposeDirectory(intent,first.merchantId,'physical',2,context).errors).toEqual({})
})
