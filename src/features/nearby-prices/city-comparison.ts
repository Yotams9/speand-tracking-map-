import type { GlobePurchase, LocalizedText } from '../../data/spendscape-globe'
import { validatePriceSnapshot, validTime, type PriceSnapshot } from './price-contract'
import { MAX_PRICE_AGE_MS, type Matches, type RowState } from './receipt-comparison'
export interface CityPublication { storeId: string; address: string; cityCode: string; directoryName: string; source: string; hash: string; publishedAt: string; fetchedAt: string; filenamePublicationRaw: string }
export interface CitySnapshot { version: 1; city: LocalizedText; directoryHash: string; cityEvidence: string; snapshot: PriceSnapshot; publications: CityPublication[]; itemUpdates: {storeId:string;productId:string;updatedRaw:string}[]; catalogScope: string }
const obj = (v:unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const keys = (v:Record<string,unknown>, fields:string[]) => Object.keys(v).length===fields.length && fields.every(f=>Object.hasOwn(v,f))
const text = (v:unknown): v is string => typeof v==='string' && v.trim()===v && v.length>0 && v.length<=160 && !/[\u0000-\u001f\u007f]/.test(v)
const hash = (v:unknown) => typeof v==='string' && /^[a-f0-9]{64}$/.test(v)
export function validateCitySnapshot(raw:unknown): CitySnapshot | null {
  if (!obj(raw)||!keys(raw,['version','city','directoryHash','cityEvidence','snapshot','publications','itemUpdates','catalogScope'])||raw.version!==1||!obj(raw.city)||!keys(raw.city,['en','he'])||raw.city.en!=='Petah Tikva'||raw.city.he!=='פתח תקווה'||!hash(raw.directoryHash)||!text(raw.cityEvidence)||!text(raw.catalogScope)) return null
  const snapshot=validatePriceSnapshot(raw.snapshot)
  if (!snapshot||snapshot.classification!=='qualified'||snapshot.source.currency!=='ILS'||!snapshot.source.currencyEvidence||snapshot.stores.length!==2||snapshot.stores.some(s=>s.coordinates!==null||s.coordinateEvidence!==null)) return null
  if (!Array.isArray(raw.publications)||raw.publications.length!==2||Object.keys(raw.publications).length!==2||!Array.isArray(raw.itemUpdates)||raw.itemUpdates.length!==snapshot.prices.length||Object.keys(raw.itemUpdates).length!==raw.itemUpdates.length) return null
  const seen=new Set<string>()
  for(const p of raw.publications) {
    if(!obj(p)||!keys(p,['storeId','address','cityCode','directoryName','source','hash','publishedAt','fetchedAt','filenamePublicationRaw'])||!text(p.storeId)||!snapshot.stores.some(s=>s.id===p.storeId)||seen.has(p.storeId)||!text(p.address)||p.cityCode!=='7900'||!text(p.directoryName)||!p.directoryName.includes('פ"ת')||!hash(p.hash)||!validTime(p.publishedAt)||!validTime(p.fetchedAt)||Date.parse(p.publishedAt)>Date.parse(p.fetchedAt)||typeof p.filenamePublicationRaw!=='string'||!/^\d{14}$/.test(p.filenamePublicationRaw)||p.filenamePublicationRaw.slice(0,8)!==p.publishedAt.slice(0,10).replaceAll('-',''))return null
    try {const u=new URL(String(p.source));if(u.origin!=='https://pricesprodpublic.blob.core.windows.net'||u.search||u.hash||u.username||u.password||!/^\/pricefull\/PriceFull7290027600007-\d{3}-\d{3}-\d{8}-\d{6}\.gz$/.test(u.pathname))return null;const parts=u.pathname.split('-');if('shufersal-'+Number(parts[2])!==p.storeId)return null;} catch {return null}
    seen.add(p.storeId)
  }
  const updates=new Set<string>()
  for(const u of raw.itemUpdates){if(!obj(u)||!keys(u,['storeId','productId','updatedRaw'])||typeof u.storeId!=='string'||typeof u.productId!=='string'||!snapshot.prices.some(p=>p.storeId===u.storeId&&p.productId===u.productId)||typeof u.updatedRaw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(u.updatedRaw)||!Number.isFinite(Date.parse(u.updatedRaw+'Z'))||new Date(u.updatedRaw+'Z').toISOString().slice(0,19)!==u.updatedRaw)return null;const key=u.storeId+'/'+u.productId;if(updates.has(key))return null;updates.add(key)}
  return structuredClone({...raw,snapshot}) as unknown as CitySnapshot
}
export function supportedCity(value:string){return ['petah tikva','פתח תקווה','פתח תקוה'].includes(value.trim().toLowerCase())?'petah-tikva':''}
export function cityComparison(purchase:GlobePurchase,city:string,raw:unknown,matches:Matches,now:number){
  const data=validateCitySnapshot(raw)
  if(city!=='petah-tikva'||!data)return {state:city?'prices-unavailable':'city-unselected',stores:[],data} as const
  const stores=data.snapshot.stores.map(store=>{
    const publication=data.publications.find(p=>p.storeId===store.id)!
    const age=now-Date.parse(publication.publishedAt),fresh=Number.isFinite(now)&&Date.parse(publication.fetchedAt)<=now&&age>=0&&age<=MAX_PRICE_AGE_MS
    const rows=purchase.items.map(item=>{
      const match=Object.hasOwn(matches,item.id)?matches[item.id]:undefined,product=data.snapshot.products.find(p=>p.id===match?.productId)
      const price=data.snapshot.prices.find(p=>p.storeId===store.id&&p.productId===product?.id)
      let state:RowState='available'
      if(!product)state='unmatched';else if(!product.brand||!product.variant)state='identity-unknown';else if(!product.package)state='package-unknown';else if(match?.confirmed!==true)state='confirm-match';else if(item.unit!=='item'||!Number.isSafeInteger(item.quantity)||item.quantity<=0)state='unsupported-unit';else if(!fresh)state='stale';else if(!price?.unitMinor)state='no-price'
      const amount=state==='available'?price!.unitMinor!*item.quantity:null
      if(amount!==null&&(!Number.isSafeInteger(amount)||amount>100000000))state='unsupported-unit'
      return {itemId:item.id,state,amountMinor:state==='available'?amount:null,updatedRaw:data.itemUpdates.find(u=>u.storeId===store.id&&u.productId===product?.id)?.updatedRaw??null}
    })
    const matchedCount=rows.filter(r=>r.state==='available').length,sum=rows.reduce((n,r)=>n+(r.amountMinor??0),0)
    return {id:store.id,label:store.label,publication,rows,matchedCount,subtotalMinor:Number.isSafeInteger(sum)?sum:null,complete:purchase.items.length>0&&matchedCount===purchase.items.length&&Number.isSafeInteger(sum)}
  })
  return {state:'comparison',stores,data} as const
}
