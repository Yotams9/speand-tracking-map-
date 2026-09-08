export const barcodeFormats = ['EAN13', 'EAN8', 'UPCA', 'UPCE'] as const
export type BarcodeFormat = typeof barcodeFormats[number]
export type BarcodeIdentity = { original: string; format: BarcodeFormat; gtin14: string }
export type BarcodeValidation = { valid: true; identity: BarcodeIdentity }
  | { valid: false; reason: 'format' | 'digits' | 'checksum' }

function validChecksum(code: string): boolean {
  const sum = [...code.slice(0, -1)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3), 0)
  return (10 - sum % 10) % 10 === Number(code.at(-1))
}

// UPC-E carries its check digit over the expanded UPC-A representation.
export function expandUpce(code: string): string {
  const [system, a, b, c, d, e, last, check] = code
  if ('012'.includes(last)) return `${system}${a}${b}${last}0000${c}${d}${e}${check}`
  if (last === '3') return `${system}${a}${b}${c}00000${d}${e}${check}`
  if (last === '4') return `${system}${a}${b}${c}${d}00000${e}${check}`
  return `${system}${a}${b}${c}${d}${e}0000${last}${check}`
}

export function validateBarcode(original: string, format: string): BarcodeValidation {
  if (!barcodeFormats.includes(format as BarcodeFormat)) return { valid: false, reason: 'format' }
  const length = format === 'EAN13' ? 13 : format === 'UPCA' ? 12 : 8
  if (!/^\d+$/.test(original) || original.length !== length || (format === 'UPCE' && !/^[01]/.test(original))) {
    return { valid: false, reason: 'digits' }
  }
  const expanded = format === 'UPCE' ? expandUpce(original) : original
  if (!validChecksum(expanded)) return { valid: false, reason: 'checksum' }
  return { valid: true, identity: { original, format: format as BarcodeFormat, gtin14: expanded.padStart(14, '0') } }
}
