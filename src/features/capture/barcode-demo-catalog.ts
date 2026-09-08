import { validateBarcode, type BarcodeFormat, type BarcodeIdentity } from './barcode-domain'

export interface DemoProduct {
  id: string
  barcode: string
  format: BarcodeFormat
  name: { en: string; he: string }
  category: { en: string; he: string }
  size: { en: string; he: string }
  provenance: 'synthetic-demo-only'
}

// Fictional identification examples, never real catalog claims or purchase evidence.
// Codes are checksum-valid demonstrations; no GS1 allocation is asserted.
export const barcodeDemoCatalog: readonly DemoProduct[] = [
  { id: 'demo-product-oats', barcode: '2000000000015', format: 'EAN13', name: { en: 'Demo oats', he: 'שיבולת שועל להדגמה' }, category: { en: 'Pantry', he: 'מזווה' }, size: { en: '500 g', he: '500 גרם' }, provenance: 'synthetic-demo-only' },
  { id: 'demo-product-tea', barcode: '2000000000022', format: 'EAN13', name: { en: 'Demo mint tea', he: 'תה נענע להדגמה' }, category: { en: 'Drinks', he: 'משקאות' }, size: { en: '20 bags', he: '20 שקיקים' }, provenance: 'synthetic-demo-only' },
  { id: 'demo-product-soap', barcode: '2000000000039', format: 'EAN13', name: { en: 'Demo hand soap', he: 'סבון ידיים להדגמה' }, category: { en: 'Care', he: 'טיפוח' }, size: { en: '250 ml', he: '250 מ״ל' }, provenance: 'synthetic-demo-only' },
  { id: 'demo-product-rice', barcode: '20000011', format: 'EAN8', name: { en: 'Demo rice', he: 'אורז להדגמה' }, category: { en: 'Pantry', he: 'מזווה' }, size: { en: '1 kg', he: '1 ק״ג' }, provenance: 'synthetic-demo-only' },
  { id: 'demo-product-cocoa', barcode: '012345678905', format: 'UPCA', name: { en: 'Demo cocoa', he: 'קקאו להדגמה' }, category: { en: 'Pantry', he: 'מזווה' }, size: { en: '200 g', he: '200 גרם' }, provenance: 'synthetic-demo-only' },
  { id: 'demo-product-gum', barcode: '01234565', format: 'UPCE', name: { en: 'Demo mint gum', he: 'מסטיק מנטה להדגמה' }, category: { en: 'Snacks', he: 'חטיפים' }, size: { en: '10 pieces', he: '10 יחידות' }, provenance: 'synthetic-demo-only' },
]

export function lookupDemoProduct(identity: BarcodeIdentity): DemoProduct | undefined {
  return barcodeDemoCatalog.find((product) => {
    const code = validateBarcode(product.barcode, product.format)
    return code.valid && code.identity.gtin14 === identity.gtin14
  })
}
