'use client'

import type { LocaleCode } from '../../data/spendscape-globe'
import type { DemoComparison } from './comparison'
import styles from './NearbyDemoCard.module.css'

export function NearbyDemoCard({ comparison: c, locale, floating = false, onDismiss }: { comparison: DemoComparison; locale: LocaleCode; floating?: boolean; onDismiss: () => void }) {
  const he = locale === 'he'
  const money = (minor: number) => new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(minor / 100)
  const date = new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(c.timestamp))
  return <aside className={`${styles.card} ${floating ? styles.floating : ''}`} data-testid="nearby-demo" aria-label={he ? 'השוואת מחירי דמו' : 'Demo price comparison'} dir={he ? 'rtl' : 'ltr'}>
    <header><span>{he ? 'מחירים וחיסכון להמחשה בלבד · חנות בדיונית' : 'Illustrative demo prices & savings · fictional store'}{floating && <strong className={styles.mobileSaving}>{he ? 'חיסכון לדוגמה' : 'Illustrative saving'} <bdi>{money(c.savingMinor)}</bdi></strong>}</span><button type="button" onClick={onDismiss} aria-label={he ? 'סגירת השוואת הדמו' : 'Dismiss demo comparison'}>×</button></header>
    <div className={styles.fullSummary}>
    <p className={styles.saving} role="status">{he ? 'חיסכון לדוגמה' : 'Illustrative saving'} <bdi>{money(c.savingMinor)}</bdi></p>
    <p>{c.store[locale]} · {c.distanceM} {he ? 'מ׳ בקו אווירי ממקום הרכישה' : 'm straight-line from purchase place'}</p>
    <p className={styles.context}>{he ? 'עבור הקבלה' : 'For the receipt'}: {c.place.name[locale]} · {c.place.branch[locale]} · {date} · <bdi>{money(Math.round(c.purchaseAmount * 100))}</bdi></p>
    <p>{he ? `${c.items.length} מתוך ${c.itemCount} פריטים הושוו` : `${c.items.length} of ${c.itemCount} items compared`}. {c.items.length < c.itemCount ? (he ? 'השוואה חלקית בלבד — לא חיסכון על הסל המלא.' : 'Partial comparison only — not a saving on the whole basket.') : (he ? 'לפריטים המוצגים בלבד.' : 'For the displayed items only.')}</p>
    </div>
    {floating && <div className={styles.mobileSummary}>
      <p>{c.store[locale]} · {c.distanceM} {he ? 'מ׳ בקו אווירי' : 'm straight-line'}</p>
      <p>{he ? `${c.items.length} מתוך ${c.itemCount} פריטים בלבד` : `${c.items.length} of ${c.itemCount} items only`}{c.items.length < c.itemCount && (he ? ' · לא הסל המלא' : ' · not the whole basket')}</p>
    </div>}
    <details><summary>{he ? 'הפריטים והסכומים שהושוו' : 'Compared items & totals'}</summary>
      {floating && <p className={`${styles.context} ${styles.mobileSummary}`}>{he ? 'עבור הקבלה' : 'For the receipt'}: {c.place.name[locale]} · {c.place.branch[locale]} · {date} · <bdi>{money(Math.round(c.purchaseAmount * 100))}</bdi></p>}
      <ul>{c.items.map(item => <li key={item.productId}><span>{item.label[locale]} × {item.quantity}</span><span>{he ? 'בקבלה' : 'Receipt'} <bdi>{money(item.paidMinor)}</bdi> · {he ? 'בדמו' : 'Demo'} <bdi>{money(item.comparedMinor)}</bdi></span></li>)}</ul>
      <p>{he ? 'סך הפריטים שהושוו בקבלה' : 'Compared receipt total'}: <bdi>{money(c.paidMinor)}</bdi><br />{he ? 'סך אותם פריטים בחנות הדמו' : 'Same items at demo store'}: <bdi>{money(c.comparedMinor)}</bdi></p>
      <p className={styles.context}>{he ? 'נתוני דמו קבועים, לא מחירי שוק או הצעה לרכישה. המרחק מחושב למיקום בדיוני, לא מסלול נסיעה.' : 'Fixed demo data, not market prices or a shopping offer. Distance is to a fictional location, not a travel route.'}</p>
    </details>
  </aside>
}
