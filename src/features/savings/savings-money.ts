// Client-safe money helper (no server imports).

/** Published prices are decimal shekels; agorot are rounded once, here. */
export function toMinor(price: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  const minor = Math.round(price * 100)
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}
