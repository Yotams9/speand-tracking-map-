import { validateBarcode } from './barcode-domain'

// ZXing 3.1.3 returns expanded EAN-13 text for UPC-E. Retain its original
// eight digits from the documented UPCE metadata, and cross-check both forms.
export function readerCandidate(result: { text: string; format: string; extra: string; isValid: boolean }) {
  let text = result.text
  let invalid = !result.isValid
  if (result.format === 'UPCE') {
    try {
      const original: unknown = JSON.parse(result.extra).UPCE
      const code = typeof original === 'string' ? validateBarcode(original, 'UPCE') : null
      const expanded = validateBarcode(result.text, 'EAN13')
      if (!code?.valid || !expanded.valid || code.identity.gtin14 !== expanded.identity.gtin14) invalid = true
      else text = code.identity.original
    } catch { invalid = true }
  } else if (result.format === 'UPCA' && /^0\d{12}$/.test(text)) {
    text = text.slice(1)
  }
  return { text: text.slice(0, 32), format: result.format, invalid }
}
