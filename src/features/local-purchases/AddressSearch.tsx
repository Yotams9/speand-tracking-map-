'use client'
import {useEffect,useRef,useState} from 'react'
import {readAddressResponse,type AddressCandidate,type SearchResult,type ResultPrecision} from './address-search'
import styles from './PurchaseLocationReview.module.css'
export function AddressAttribution() { return <small>Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></small> }
export function precisionLabel(p: ResultPrecision,he: boolean) {
  return ['building','amenity'].includes(p) ? (he?'נקודת כתובת מוצעת, לא אימות חנות':'Proposed address point, not store verification') : p==='street' ? (he?'רמת רחוב בלבד':'Street-level only') : (he?'אזור בלבד; לא מיקום חנות':'Area only; not a store location')
}
export function AddressSearch({address,he,onPropose,onSearch}:{address:string;he:boolean;onPropose:(c:AddressCandidate)=>void;onSearch:()=>void}) {
  const [fictional,setFictional]=useState(false),[native,setNative]=useState(false),[consumed,setConsumed]=useState(false)
  const [available,setAvailable]=useState(false),[loading,setLoading]=useState(false),[consent,setConsent]=useState(false),[result,setResult]=useState<SearchResult|null>(null)
  const generation=useRef(0),controller=useRef<AbortController|null>(null),alive=useRef(false),active=useRef(false)
  useEffect(()=>{alive.current=true;const c=new AbortController();fetch('/api/address-search',{cache:'no-store',signal:c.signal}).then(async r=>{const v=await r.json();if(alive.current&&!c.signal.aborted){setAvailable(r.ok&&v?.status==='available');setFictional(v?.mode==='fictional-qa');setNative(v?.mode==='native');setConsumed(v?.status==='consumed')}}).catch(()=>{});return()=>{alive.current=false;c.abort();controller.current?.abort();generation.current++}},[])
  const cancel=()=>{generation.current++;controller.current?.abort();controller.current=null;active.current=false;setLoading(false);setResult(null)}
  useEffect(()=>{cancel();setConsent(false)},[address]) // every edit invalidates candidate ownership
  const messages:Record<string,string>={disabled:he?'חיפוש כתובת כבוי עד להפעלה מאושרת. אפשר לבחור במפה, להזין נקודה ידועה או לבטל.':'Address search is disabled until approved activation. Use the map, enter a known point, or cancel.',invalid:he?'הזינו כתובת בלבד, כולל עיר ומדינה, עד 100 תווים.':'Enter only an address, including city and country, up to 100 characters.', 'no-results':he?'לא נמצאו תוצאות. המיקום הקודם לא השתנה.':'No results. The previous location is unchanged.',timeout:he?'החיפוש עבר את הזמן המותר. לא בוצע ניסיון נוסף.':'Search timed out. No retry was made.',cancelled:he?'החיפוש בוטל.':'Search cancelled.',quota:he?'מכסת הספק נדחתה. לא בוצע ניסיון נוסף.':'Provider quota rejected. No retry was made.', 'http-error':he?'הספק דחה את החיפוש. לא בוצע ניסיון נוסף.':'Provider rejected the search. No retry was made.', malformed:he?'תוצאה לא נתמכת או לא תקינה. לא נבחרה נקודה.':'Unsupported or invalid result. No point was selected.',unavailable:he?'החיפוש לא זמין. המיקום הקודם לא השתנה.':'Search unavailable. The previous location is unchanged.',consumed:he?'החיפוש המאושר כבר נוצל.':'The approved search has already been consumed.'}
  return <section aria-label={he?'חיפוש כתובת':'Address search'} data-testid="address-search" className={styles.search}>
    <p>{he?'חיפוש שולח רק את הכתובת שבדקתם ואת שפת התוצאות. לא נשלחים תמונת הקבלה, מוצרים או תשלום. תוצאה עכשווית אינה מוכיחה שהעסק היה כאן בתאריך הרכישה.':'Search sends only your reviewed address and result language. No receipt image, products or payment are sent. A current result does not establish the merchant was here on the purchase date.'}</p>
    {fictional&&<p role="status">{he?'הדגמה מקומית בדיונית בלבד; אין חיפוש אצל ספק.':'Fictional local QA only; no provider search.'}</p>}
    {!available?<p role="status" data-testid="address-search-disabled">{consumed?messages.consumed:messages.disabled}</p>:<>
      <label className={styles.confirm}><input type="checkbox" data-testid="address-search-consent" checked={consent} onChange={e=>setConsent(e.target.checked)} />{he?'אני מאשר/ת לשלוח את הכתובת לעיון בהצעות מיקום.':'I approve sending this address to view location suggestions.'}</label>
      <button type="button" data-testid="address-search-submit" disabled={consumed||loading||!consent||!address.trim()} onClick={async()=>{
        if(active.current||consumed)return;active.current=true;if(native)setConsumed(true);onSearch();setLoading(true);setResult(null)
        const current=++generation.current,c=new AbortController();controller.current=c
        const timer=setTimeout(()=>c.abort(),10_000)
        try {const r=await fetch('/api/address-search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:address.trim(),locale:he?'he':'en'}),cache:'no-store',signal:c.signal});const v=await readAddressResponse(r);if(alive.current&&generation.current===current&&!c.signal.aborted)setResult(v as SearchResult)}
        catch {if(alive.current&&generation.current===current)setResult({status:c.signal.aborted?'timeout':'unavailable'})}
        finally {clearTimeout(timer);if(alive.current&&generation.current===current){active.current=false;setLoading(false);controller.current=null}}
      }}>{loading?(he?'מחפשים…':'Searching…'):(he?'חיפוש הכתובת שבדקתי':'Search my reviewed address')}</button>
      {loading&&<button type="button" data-testid="address-search-cancel" onClick={cancel}>{he?'ביטול החיפוש':'Cancel search'}</button>}
    </>}
    {available&&consumed&&!loading&&<p role="status">{messages.consumed}</p>}
    {result&&result.status!=='results'&&<p role="alert" data-testid="address-search-error">{messages[result.status]}</p>}
    {result?.status==='results'&&<><p>{he?'בחרו הצעה לתצוגה במפה בלבד; היא לא נשמרת ולא מאושרת.':'Select a suggestion for map preview only; it is not saved or confirmed.'}</p><ul>{result.candidates.map((c,i)=><li key={i}><p>{c.address}<small>{precisionLabel(c.provenance.precision,he)} · {c.provenance.match==='full'?(he?'רמת הכתובת תואמת':'Address level matched'):(he?'התאמה חלקית או לא ידועה':'Partial or unknown match')}</small></p><button type="button" data-testid={`address-candidate-${i}`} onClick={()=>onPropose(c)}>{he?'הצעה ותצוגה במפה':'Propose and preview on map'}</button></li>)}</ul><AddressAttribution/></>}
  </section>
}
