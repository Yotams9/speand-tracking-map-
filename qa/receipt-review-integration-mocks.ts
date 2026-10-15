import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'
// Fictional, QA-only observations. Not extracted provider evidence.
export const oneReceipt: ReceiptObservations = {
  merchantName: 'מכולת בדויה בלבד', address: 'רחוב דמיוני 12', date: '2026-10-03', time: '09:15', currency: 'ILS', finalAmount: '12.50',
  lines: [{name:'קוואקר לדוגמה Oats', quantity:'2', unit:'item', unitPrice:'6.25', lineAmount:'12.50'}],
}
export const fifteenReceipt: ReceiptObservations = {
  ...oneReceipt, finalAmount:'41.00', lines:[
    {name:'לחם בדוי Bread',quantity:'2',unit:'item',unitPrice:'3.25',discount:'0.50',lineAmount:'6.00'},
    {name:'תפוחים לדוגמה Apples',quantity:'0.375',unit:'kg',unitPrice:'24.00',lineAmount:'9.00'},
    ...Array.from({length:13}, (_,i) => ({name:`פריט בדוי ${i%3+1} Demo`,quantity:'1',unit:'item',unitPrice:'2.00',lineAmount:'2.00'})),
  ],
}
