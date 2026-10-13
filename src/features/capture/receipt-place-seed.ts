// Temporary review-to-location handoff only. Never a resolved place or coordinate.
export interface ReceiptPlaceSeed { branch: string; address: string; city: string; country: string }
export function receiptPlaceSeed(branch: string, address: string): ReceiptPlaceSeed {
  const parts = address.split(',').map(s => s.trim())
  const printedCountry = parts.at(-1)
  const country = printedCountry === 'Israel' || printedCountry === 'ישראל' ? printedCountry : ''
  // Only the explicit three-segment "street, city, country" layout is supported.
  // Numeric/subaddress segments and unsegmented Hebrew text stay unresolved.
  const city = country && parts.length === 3 && /^[\p{L}\p{M} .'-]{1,100}$/u.test(parts[1]) ? parts[1] : ''
  return { branch, address, city, country }
}
