import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'

// Fictional QA observations, never provider output or a real receipt transcript.
// Five product rows, seven units: 6055 minor units of products, 6050 payable.
export const payableReceipt: ReceiptObservations = {
  merchantName: 'Fictional payable shop · חנות בדויה', address: 'Fictional street · רחוב בדוי',
  date: '2013-09-30', time: '11:57', currency: 'ILS', finalAmount: '60.50',
  lines: [
    { name: 'לחם בדוי Bread', quantity: '1', unit: 'item', unitPrice: '10.00', lineAmount: '10.00' },
    { name: 'עוגיות בדויות Cookies', quantity: '1', unit: 'item', unitPrice: '20.00', lineAmount: '20.00' },
    { name: 'חלב בדוי Milk', quantity: '2', unit: 'item', unitPrice: '7.50', lineAmount: '15.00' },
    { name: 'יוגורט בדוי Yogurt', quantity: '1', unit: 'item', unitPrice: '8.55', lineAmount: '8.55' },
    { name: 'מעדן בדוי Dessert', quantity: '2', unit: 'item', unitPrice: '3.50', lineAmount: '7.00' },
  ],
}
