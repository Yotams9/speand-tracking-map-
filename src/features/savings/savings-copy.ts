import type { LocaleCode } from '../../data/spendscape-globe'
import type { NotComparedReason } from './savings-engine'

export const savingsCopy = {
  he: {
    title: 'איפה זה זול יותר?',
    loading: 'משווים מחירי מדף בסניפים בסביבה…',
    error: 'לא ניתן להשוות מחירים כרגע. נסו שוב מאוחר יותר.',
    retry: 'ניסיון נוסף',
    save: 'היית חוסך {amount}',
    at: 'ב',
    away: '{distance} מכאן',
    here: 'הסניף שבו קנית',
    basisShelf: 'בהשוואה למחיר המדף בסניף שבו קנית ({amount})',
    basisPaid: 'בהשוואה למה ששילמת ({amount})',
    cheapestShelf: 'קנית בסניף הזול ביותר בסביבה.',
    cheapestPaid: 'שילמת לא יותר ממחיר המדף הזול ביותר בסביבה.',
    noBaseline: 'המחיר הזול ביותר בסביבה. אין לנו את המחיר ששילמת לפריטים האלה, ולכן לא מחושב חיסכון.',
    noComplete: 'אף סניף ברדיוס {radius} לא מפרסם מחיר לכל הפריטים, ולכן אין השוואת סל.',
    nothing: 'אין בקנייה הזו פריטים שאפשר להשוות לפי ברקוד.',
    storeTotal: 'סה״כ בסניף',
    alternatives: 'סניפים נוספים עם כל הפריטים',
    partial: 'סניפים עם חלק מהפריטים · לא נכללים בחיסכון',
    partialCount: 'יש {count} מתוך {total} פריטים',
    notCompared: 'לא הושוו',
    reasons: { 'no-barcode': 'אין ברקוד לשורה הזו', 'invalid-barcode': 'ברקוד לא תקין', 'not-in-catalog': 'לא נמצא במחירוני תל אביב', weighted: 'מוצר במשקל', 'unsupported-quantity': 'כמות שאינה יחידות שלמות' } satisfies Record<NotComparedReason, string>,
    showOnGlobe: 'הצגת הסניף על הגלובוס',
    radius: 'סניפים ברדיוס {radius} ממקום הקנייה, לפי ברקוד זהה בלבד, בלי לפצל סל בין סניפים.',
    radiusDevice: 'סניפים ברדיוס {radius} מהמיקום שלך, לפי ברקוד זהה בלבד, בלי לפצל סל בין סניפים.',
    priceDate: 'מחירי מדף שפורסמו ב-{date}, ללא מבצעים',
    notLive: 'זה לא מחיר עדכני, מלאי או מחיר בקופה.',
    noPlace: 'לקנייה הזו אין מקום עם מיקום. אפשר להשוות לפי המיקום הנוכחי שלך.',
    useLocation: 'שימוש במיקום שלי',
    locating: 'מאתרים את המיקום…',
    locationFailed: 'המיקום אינו זמין כאן.',
    locationNote: 'המיקום נקרא פעם אחת, משמש רק כנקודת מוצא להשוואה ואינו נשמר.',
    metres: '{n} מ׳', km: '{n} ק״מ',
  },
  en: {
    title: 'Where is it cheaper?',
    loading: 'Comparing shelf prices at nearby branches…',
    error: 'Prices could not be compared right now. Try again later.',
    retry: 'Try again',
    save: 'You’d save {amount}',
    at: 'at ',
    away: '{distance} away',
    here: 'Where you bought',
    basisShelf: 'vs the shelf price where you bought ({amount})',
    basisPaid: 'vs what you paid ({amount})',
    cheapestShelf: 'You already shopped at the cheapest store nearby.',
    cheapestPaid: 'You paid no more than the cheapest shelf price nearby.',
    noBaseline: 'Cheapest nearby. We don’t have what you paid for these items, so no saving is calculated.',
    noComplete: 'No branch within {radius} publishes a price for every item, so there is no basket comparison.',
    nothing: 'This purchase has no items that can be compared by barcode.',
    storeTotal: 'Total at this branch',
    alternatives: 'Other branches with every item',
    partial: 'Branches with only some items · not used for savings',
    partialCount: 'Has {count} of {total} items',
    notCompared: 'Not compared',
    reasons: { 'no-barcode': 'No barcode for this line', 'invalid-barcode': 'Invalid barcode', 'not-in-catalog': 'Not in the Tel Aviv price files', weighted: 'Sold by weight', 'unsupported-quantity': 'Quantity is not whole units' } satisfies Record<NotComparedReason, string>,
    showOnGlobe: 'Show this branch on the globe',
    radius: 'Branches within {radius} of where you bought, identical barcode only, never splitting a basket across stores.',
    radiusDevice: 'Branches within {radius} of your location, identical barcode only, never splitting a basket across stores.',
    priceDate: 'Shelf prices published on {date}, without promotions',
    notLive: 'Not a current price, stock level or checkout price.',
    noPlace: 'This purchase has no located place. You can compare from your current location.',
    useLocation: 'Use my location',
    locating: 'Finding your location…',
    locationFailed: 'Location is unavailable here.',
    locationNote: 'Your location is read once, used only as the comparison origin and not saved.',
    metres: '{n} m', km: '{n} km',
  },
} as const

export function formatMinorIls(minor: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(minor / 100)
}

export function formatDistance(metres: number, locale: LocaleCode): string {
  const t = savingsCopy[locale]
  if (metres < 1000) return t.metres.replace('{n}', String(Math.round(metres / 10) * 10))
  return t.km.replace('{n}', (Math.round(metres / 100) / 10).toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB'))
}

/** "2026-10-04 03:00" → "4.10.2026". */
export function publishedDate(publishedLocal: string | null): string {
  const match = publishedLocal?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${Number(match[3])}.${Number(match[2])}.${match[1]}` : ''
}
