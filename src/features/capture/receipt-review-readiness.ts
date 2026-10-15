import type { ReviewErrors } from './session-purchase-domain'

// Presentation of the actual prepareReceiptReview result, never a second validator.
// Coalesce dependent quantity/line errors while a required unit is unresolved.
const headers = new Set(['date', 'currency', 'amount', 'merchantId', 'merchantName', 'merchantCategory',
  'merchantSeparate', 'placeId', 'channel', 'payment', 'category', 'baseAmount', 'directory',
  'place-branch', 'place-city', 'place-country', 'place-address', 'place-longitude', 'place-latitude',
  'place-confirmed', 'place-separate', 'lines'])
const rowField = /^(name|quantity|price|unit|printedAmount|discount)-(\d{1,2})$/
export function receiptBlockerFields(errors: ReviewErrors): string[] {
  const keys = Object.keys(errors)
  const rows = keys.some(k => rowField.test(k))
  const result = keys.filter(k => !(k === 'lines' && rows) &&
    !(k.startsWith('quantity-') && Object.hasOwn(errors, k.replace('quantity-', 'unit-'))))
    .map(k => headers.has(k) || (rowField.test(k) && Number(k.split('-')[1]) < 50) ? k : 'other')
  return [...new Set(result)]
}
export function receiptBlockerLabel(field: string, he: boolean): string {
  const row = rowField.exec(field)
  const lineLabels = he ? { name: 'יש לבדוק את שם הפריט', quantity: 'יש לבדוק את הכמות', price: 'יש לבדוק את מחיר היחידה', unit: 'יש לבחור יחידה לאימות הכמות', printedAmount: 'יש לבדוק את הסכום המודפס וחישוב השורה', discount: 'יש לבדוק את הנחת השורה' }
    : { name: 'Review the description', quantity: 'Review the quantity', price: 'Review the unit price', unit: 'Choose a unit to validate quantity', printedAmount: 'Review the printed amount and line arithmetic', discount: 'Review the line discount' }
  if (row) return `${he ? 'פריט' : 'Item'} ${Number(row[2]) + 1}: ${lineLabels[row[1] as keyof typeof lineLabels]}`
  const labels: Record<string, string> = he ? {
    date: 'יש לאשר תאריך, שעה ואזור זמן תקינים', currency: 'יש לבחור מטבע', amount: 'יש לבדוק את הסכום הסופי לתשלום',
    merchantId: 'יש לבחור חנות קיימת או לבדוק ולהוסיף את החנות שנצפתה', merchantName: 'יש לבדוק את שם החנות', merchantCategory: 'יש לבחור קטגוריית חנות', merchantSeparate: 'יש לבחור חנות קיימת או לאשר שזו חנות נפרדת',
    placeId: 'יש לבחור מקום מאושר או מקום לא פתור ללא סיכה', channel: 'יש לבחור ערוץ, או מקום לא פתור ללא סיכה',
    payment: 'יש לבחור אמצעי תשלום או לסמן במפורש שאינו ידוע', category: 'יש לבחור קטגוריית רכישה', baseAmount: 'יש להשלים סכום בש״ח שאפשר לאשר',
    directory: 'יש לבדוק את החנות והמקום', lines: 'יש להשלים 1–50 פריטים תקינים',
    'place-branch': 'יש להשלים שם סניף', 'place-city': 'יש להשלים עיר', 'place-country': 'יש להשלים מדינה', 'place-address': 'יש לבדוק את כתובת המקום',
    'place-longitude': 'יש לבדוק את קו האורך או לבחור מקום לא פתור', 'place-latitude': 'יש לבדוק את קו הרוחב או לבחור מקום לא פתור', 'place-confirmed': 'יש לאשר את המיקום או לבחור מקום לא פתור', 'place-separate': 'יש לבחור מקום קיים או לאשר שזה מקום נפרד', other: 'יש לבדוק את שדות החובה המסומנים',
  } : {
    date: 'Confirm a valid receipt date, time and timezone', currency: 'Choose a currency', amount: 'Review the final payable total',
    merchantId: 'Choose an existing store or review and create the observed store', merchantName: 'Review the store name', merchantCategory: 'Choose a store category', merchantSeparate: 'Reuse the existing store or confirm a separate store',
    placeId: 'Choose a confirmed place or unresolved location with no pin', channel: 'Choose a channel, or unresolved location with no pin',
    payment: 'Choose payment context, or explicitly mark it unknown', category: 'Choose a purchase category', baseAmount: 'Enter the ILS amount you can confirm', directory: 'Review the store and place', lines: 'Provide 1–50 valid items',
    'place-branch': 'Complete the branch name', 'place-city': 'Complete the city', 'place-country': 'Complete the country', 'place-address': 'Review the place address',
    'place-longitude': 'Review longitude or choose unresolved location', 'place-latitude': 'Review latitude or choose unresolved location', 'place-confirmed': 'Confirm the location or choose unresolved location', 'place-separate': 'Reuse the existing place or confirm a separate place', other: 'Check the other highlighted required fields',
  }
  return labels[field] ?? labels.other
}
