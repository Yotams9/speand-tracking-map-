'use client'
import {useEffect,useRef,useState} from 'react'
import {readAddressResponse,type AddressCandidate,type SearchResult,type ResultPrecision} from './address-search'
import {reviewedAddressQuery} from './address-query'
import styles from './PurchaseLocationReview.module.css'
export function AddressAttribution() { return <small>Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></small> }
export function precisionLabel(p: ResultPrecision,he: boolean) {
  return ['building','amenity'].includes(p) ? (he?'נקודת כתובת מוצעת, לא אימות חנות':'Proposed address point, not store verification') : p==='street' ? (he?'רמת רחוב בלבד':'Street-level only') : (he?'אזור בלבד; לא מיקום חנות':'Area only; not a store location')
}
export function AddressSearch({address,city='',country='',he,onPropose,onSearch}:{address:string;city?:string;country?:string;he:boolean;onPropose:(c:AddressCandidate)=>void;onSearch:()=>void}) {
  const query=reviewedAddressQuery(address,city,country)
  const [fictional,setFictional]=useState(false),[native,setNative]=useState(false),[consumed,setConsumed]=useState(false)
  const [session,setSession]=useState<{remaining:number;expiresAt:number}|null>(null),[capability,setCapability]=useState('disabled')
  const statusGeneration=useRef(0)
  const [available,setAvailable]=useState(false),[loading,setLoading]=useState(false),[consent,setConsent]=useState(false),[result,setResult]=useState<SearchResult|null>(null)
  const generation=useRef(0),controller=useRef<AbortController|null>(null),alive=useRef(false),active=useRef(false)
  const refresh=async(signal?:AbortSignal)=>{
    const token=++statusGeneration.current
    try{const r=await fetch('/api/address-search',{cache:'no-store',signal});const v=await r.json()
      if(!alive.current||signal?.aborted||token!==statusGeneration.current)return
      const operational=v?.mode==='native-session'&&Number.isInteger(v.session?.remaining)&&v.session.remaining>=0&&v.session.remaining<=10&&Number.isSafeInteger(v.session.expiresAt)
      setSession(operational?{remaining:v.session.remaining,expiresAt:v.session.expiresAt}:null)
      setCapability(['available','consumed','expired','limit-reached','session-stopped','busy'].includes(v?.status)?v.status:'disabled')
      setAvailable(r.ok&&v?.status==='available');setFictional(v?.mode==='fictional-qa');setNative(v?.mode==='native');setConsumed(v?.status==='consumed')
    }catch{if(alive.current&&!signal?.aborted&&token===statusGeneration.current){setAvailable(false);setCapability('unavailable')}}
  }
  useEffect(()=>{alive.current=true;const c=new AbortController();void refresh(c.signal);return()=>{alive.current=false;statusGeneration.current++;c.abort();controller.current?.abort();generation.current++}},[])
  useEffect(()=>{if(!session)return;const expire=()=>{setAvailable(false);setCapability('expired')};const delay=session.expiresAt-Date.now();if(delay<=0){expire();return}const timer=setTimeout(expire,Math.min(delay,7_200_000));return()=>clearTimeout(timer)},[session])
  const cancel=()=>{generation.current++;controller.current?.abort();controller.current=null;active.current=false;setLoading(false);setResult(null);if(session)void refresh()}
  useEffect(()=>{cancel();setConsent(false)},[address,city,country]) // every address/context edit invalidates candidate ownership
  const messages:Record<string,string>={disabled:he?'חיפוש כתובת כבוי עד להפעלה מאושרת. אפשר לבחור במפה, להזין נקודה ידועה או לבטל.':'Address search is disabled until approved activation. Use the map, enter a known point, or cancel.',invalid:he?'הזינו כתובת בלבד, כולל עיר ומדינה, עד 100 תווים.':'Enter only an address, including city and country, up to 100 characters.', 'no-results':he?'לא נמצאו תוצאות. המיקום הקודם לא השתנה.':'No results. The previous location is unchanged.',timeout:he?'החיפוש עבר את הזמן המותר. לא בוצע ניסיון נוסף.':'Search timed out. No retry was made.',cancelled:he?'החיפוש בוטל.':'Search cancelled.',quota:he?'מכסת הספק נדחתה. לא בוצע ניסיון נוסף.':'Provider quota rejected. No retry was made.', 'http-error':he?'הספק דחה את החיפוש. לא בוצע ניסיון נוסף.':'Provider rejected the search. No retry was made.', malformed:he?'תוצאה לא נתמכת או לא תקינה. לא נבחרה נקודה.':'Unsupported or invalid result. No point was selected.',unavailable:he?'החיפוש לא זמין. המיקום הקודם לא השתנה.':'Search unavailable. The previous location is unchanged.',expired:he?'תוקף הפעלת החיפוש פג. אפשר לשמור ללא מיקום.':'The address-search session expired. You can keep location unresolved.', 'limit-reached':he?'מכסת החיפושים להפעלה זו נוצלה. לא יבוצע חיפוש נוסף.':'This session’s search limit has been reached. No further search will be sent.', 'session-stopped':he?'ההפעלה נעצרה לאחר שגיאה. לא יבוצע ניסיון נוסף.':'The session stopped after an error. No retry will be sent.',busy:he?'חיפוש נמצא בתהליך או הופסק. בדקו זמינות; לא נשלח חיפוש נוסף.':'A search is in progress or was interrupted. Check availability; no additional search was sent.',duplicate:he?'השליחה הזו כבר נספרה. לא נשלח חיפוש נוסף.':'This submission was already counted. No additional search was sent.',consumed:he?'החיפוש המאושר כבר נוצל.':'The approved search has already been consumed.'}
  return <section aria-label={he?'חיפוש כתובת':'Address search'} data-testid="address-search" className={styles.search}>
    <p>{he?'חיפוש שולח רק את הכתובת שבדקתם ואת שפת התוצאות. לא נשלחים תמונת הקבלה, מוצרים או תשלום. תוצאה עכשווית אינה מוכיחה שהחנות הייתה כאן בתאריך הרכישה.':'Search sends only your reviewed address and result language. No receipt image, products or payment are sent. A current result does not establish the store was here on the purchase date.'}</p>
    {query&&<p data-testid="address-search-query">{he?'הכתובת שתישלח לחיפוש:':'Address to search:'} <bdi dir="auto">{query}</bdi></p>}
    {session&&<p role="status" data-testid="address-session-status">{he?'חיפושים שנותרו בהפעלה:':'Searches remaining in this session:'} {session.remaining} · {he?'בתוקף עד':'Expires'} {new Date(session.expiresAt).toLocaleTimeString(he?'he-IL':'en-GB')}</p>}
    {['busy','unavailable'].includes(capability)&&!loading&&<button type="button" onClick={()=>void refresh()}>{he?'בדיקת זמינות חיפוש':'Check search availability'}</button>}
    {fictional&&<p role="status">{he?'הדגמה מקומית בדיונית בלבד; אין חיפוש אצל ספק.':'Fictional local QA only; no provider search.'}</p>}
    {!available?<p role="status" data-testid="address-search-disabled">{messages[capability]??messages.disabled}</p>:<>
      <label className={styles.confirm}><input type="checkbox" data-testid="address-search-consent" checked={consent} onChange={e=>setConsent(e.target.checked)} />{he?'אני מאשר/ת לשלוח את הכתובת לעיון בהצעות מיקום.':'I approve sending this address to view location suggestions.'}</label>
      <button type="button" data-testid="address-search-submit" disabled={consumed||loading||!consent||!query} onClick={async()=>{
        if(active.current||consumed)return;active.current=true;if(native)setConsumed(true);onSearch();setLoading(true);setResult(null)
        const current=++generation.current,c=new AbortController();controller.current=c
        const timer=setTimeout(()=>c.abort(),10_000)
        try {const r=await fetch('/api/address-search',{method:'POST',headers:{'content-type':'application/json',...(session?{'x-spendscape-address-submission':crypto.randomUUID().replaceAll('-','')}: {})},body:JSON.stringify({address:query,locale:he?'he':'en'}),cache:'no-store',signal:c.signal});const v=await readAddressResponse(r);if(alive.current&&generation.current===current&&!c.signal.aborted)setResult(v as SearchResult)}
        catch {if(alive.current&&generation.current===current)setResult({status:c.signal.aborted?'timeout':'unavailable'})}
        finally {clearTimeout(timer);if(alive.current&&generation.current===current){active.current=false;setLoading(false);controller.current=null;if(session)void refresh()}}
      }}>{loading?(he?'מחפשים…':'Searching…'):(he?'חיפוש הכתובת שבדקתי':'Search my reviewed address')}</button>
      {loading&&<button type="button" data-testid="address-search-cancel" onClick={cancel}>{he?'ביטול החיפוש':'Cancel search'}</button>}
    </>}
    {available&&consumed&&!loading&&<p role="status">{messages.consumed}</p>}
    {result&&result.status!=='results'&&<p role="alert" data-testid="address-search-error">{messages[result.status]}</p>}
    {result?.status==='results'&&<><p>{he?'בחרו הצעה לתצוגה במפה בלבד; היא לא נשמרת ולא מאושרת.':'Select a suggestion for map preview only; it is not saved or confirmed.'}</p><ul>{result.candidates.map((c,i)=><li key={i}><p>{c.address}<small>{precisionLabel(c.provenance.precision,he)} · {c.provenance.match==='full'?(he?'רמת הכתובת תואמת':'Address level matched'):(he?'התאמה חלקית או לא ידועה':'Partial or unknown match')}</small></p><button type="button" data-testid={`address-candidate-${i}`} onClick={()=>onPropose(c)}>{he?'הצעה ותצוגה במפה':'Propose and preview on map'}</button></li>)}</ul><AddressAttribution/></>}
  </section>
}
