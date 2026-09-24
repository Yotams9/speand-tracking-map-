// Fictional college-demo prices and location. No retailer/NP artifacts or
// external product identifiers. These IDs refer only to the built-in receipt.
export const demoStore = {
  name: { en: 'Demo Grove Market', he: 'מרקט החורשה — דמו' },
  coordinates: [34.779, 32.078] as const,
  currency: 'ILS' as const,
  prices: [
    { productId: 'demo_sourdough', label: { en: 'Olive sourdough', he: 'לחם מחמצת זיתים' }, unit: 'item', unitMinor: 1600 },
    { productId: 'demo_tahini', label: { en: 'Whole sesame tahini', he: 'טחינה משומשום מלא' }, unit: 'item', unitMinor: 2190 },
  ],
}
