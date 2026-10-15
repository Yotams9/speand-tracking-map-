import type { CurrencyCode, LocaleCode } from '../../data/spendscape-globe'

// The difference is a derived notice, never an allocated line discount or a
// stored explanation. Unknown/invalid totals remain visibly unresolved.
export function ReceiptPayableSummary({ itemMinor, payableMinor, currency, locale, review = false }: {
  itemMinor: number | null; payableMinor: number | null; currency: CurrencyCode | ''; locale: LocaleCode; review?: boolean
}) {
  const he = locale === 'he', factor = currency === 'JPY' ? 1 : 100
  const money = (minor: number | null) => currency && minor !== null
    ? new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency }).format(minor / factor) : '—'
  const difference = itemMinor !== null && payableMinor !== null ? itemMinor - payableMinor : null
  return <div data-testid="receipt-payable-summary">
    <p>{he ? 'סכום שורות הפריטים' : 'Sum of product lines'}: <bdi>{money(itemMinor)}</bdi></p>
    <p>{he ? 'סכום סופי לתשלום' : 'Final payable total'}: <bdi>{money(payableMinor)}</bdi></p>
    {difference !== null && difference !== 0 && <p role="status" data-testid="receipt-total-notice">
      {he ? 'הפרש בין סכום הפריטים לסכום לתשלום' : 'Difference between product sum and payable total'}: <bdi>{money(Math.abs(difference))}</bdi>.{' '}
      {review
        ? he ? 'זהו מידע לבדיקה ואינו חוסם שמירה. יש לאשר את הסכום הסופי; סכומי השורות נשמרים ללא שינוי.' : 'This is a nonblocking review notice. Confirm the final payable total; product line amounts remain unchanged.'
        : he ? 'סיכומי ההוצאות משתמשים בסכום הסופי לתשלום. סכומי שורות הפריטים נשמרים ללא שינוי.' : 'Spending totals use the final payable total. Product line amounts remain unchanged.'}
    </p>}
  </div>
}
