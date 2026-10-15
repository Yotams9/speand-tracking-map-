import type { OcrDocument, OcrWord } from './ocr-parser'

// Fictional word geometry; never a recognition result or expected-answer input.
// Imported by the server QA adapter/tests only, not the consumer module graph.
export function fictionalOcr(fixture: 'one' | 'fifteen'): OcrDocument {
  const words: OcrWord[] = []
  const word = (text: string, x: number, y: number, width = Math.max(20, text.length * 8)) => words.push({ text, x, y, width, height: 20 })
  const translated: Record<string, string> = { Merchant: 'בית עסק', Address: 'כתובת', Date: 'תאריך', Time: 'שעה', Currency: 'מטבע', Total: 'לתשלום' }
  const head = (key: string, value: string, y: number) => { word((fixture === 'fifteen' ? translated[key] : key) + ':', fixture === 'fifteen' ? 840 : 30, y, 100); word(value, fixture === 'fifteen' ? 400 : 160, y) }
  head('Merchant', 'Fictional Demo Market', 20); head('Address', 'Imaginary Street 12', 55)
  head('Date', '2026-10-03', 90); head('Time', '09:15', 125); head('Currency', 'ILS', 160)
  if (fixture === 'one') {
    const xs = [30, 380, 480, 590, 760]
    ;['Item', 'Qty', 'Unit', 'Price', 'Amount'].forEach((t, i) => word(t, xs[i], 210))
    ;['קוואקר בדוי Oats', '2', 'item', '6.25', '12.50'].forEach((t, i) => word(t, xs[i], 250))
    head('Total', '12.50', 310)
  } else {
    // RTL column order is derived from printed header geometry, not locale.
    const keys = ['סכום', 'הנחה', 'מחיר', 'יחידה', 'כמות', 'פריט'], xs = [30, 150, 270, 390, 490, 620]
    keys.forEach((t, i) => word(t, xs[i], 210))
    const rows = [
      ['6.00', '0.50', '3.25', 'יח׳', '2', 'לחם בדוי Bread'],
      ['9.00', '0.00', '24.00', 'ק״ג', '0.375', 'תפוחים בדויים Apples'],
      ...Array.from({ length: 13 }, (_, i) => ['2.00', '0.00', '2.00', 'יח׳', '1', `פריט בדוי ${i % 3 + 1} Demo`]),
    ]
    rows.forEach((row, r) => row.forEach((t, i) => word(t, xs[i], 250 + r * 35)))
    head('Total', '41.00', 820)
  }
  return { version: 1, width: 1000, height: 1000, words }
}
