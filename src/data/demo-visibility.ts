import type { LocaleCode, Merchant, Place } from './spendscape-globe'
import type { SpendscapeDataSnapshot } from './spendscape-repository'

// Synthetic demo purchases are hidden until the person asks for them. The
// choice (and the language) is a per-device preference, never purchase data.
export const DEMO_DATA_KEY = 'spendscape.demo-data.v1'
export const LOCALE_KEY = 'spendscape.locale.v1'
export const DEFAULT_LOCALE: LocaleCode = 'he'

// Kept for every visitor: the "store not identified" choice for an unknown channel.
const ALWAYS_OFFERED_MERCHANTS = new Set(['merchant_unresolved'])

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readDemoPreference(storage: PreferenceStorage | null): boolean {
  try { return storage?.getItem(DEMO_DATA_KEY) === 'on' } catch { return false }
}

export function writeDemoPreference(storage: PreferenceStorage | null, on: boolean): void {
  try { storage?.setItem(DEMO_DATA_KEY, on ? 'on' : 'off') } catch { /* storage blocked: the choice lasts this visit */ }
}

export function readLocalePreference(storage: PreferenceStorage | null): LocaleCode | null {
  try {
    const value = storage?.getItem(LOCALE_KEY)
    return value === 'en' || value === 'he' ? value : null
  } catch { return null }
}

export function writeLocalePreference(storage: PreferenceStorage | null, locale: LocaleCode): void {
  try { storage?.setItem(LOCALE_KEY, locale) } catch { /* storage blocked */ }
}

const none = Object.freeze([]) as readonly never[]

/** The demo story (purchases, their evidence and inbox questions) only when demo data is on. */
export function demoStory(snapshot: SpendscapeDataSnapshot, demoOn: boolean): Pick<SpendscapeDataSnapshot, 'purchases' | 'evidence' | 'smartInboxCases'> {
  return demoOn
    ? { purchases: snapshot.purchases, evidence: snapshot.evidence, smartInboxCases: snapshot.smartInboxCases }
    : { purchases: none, evidence: none, smartInboxCases: none }
}

/**
 * Stores offered in the purchase form. With demo data off the fictional demo
 * stores are left out, except any the person's own saved purchases already use.
 * Lookups and validation keep the full directory so nothing saved is lost.
 */
export function offeredDirectory(
  directory: { merchants: readonly Merchant[]; places: readonly Place[] },
  demoMerchantIds: ReadonlySet<string>,
  demoPlaceIds: ReadonlySet<string>,
  usedIds: { merchantIds: ReadonlySet<string>; placeIds: ReadonlySet<string> },
  demoOn: boolean,
): { merchants: readonly Merchant[]; places: readonly Place[] } {
  if (demoOn) return directory
  return {
    merchants: directory.merchants.filter((merchant) => !demoMerchantIds.has(merchant.id)
      || ALWAYS_OFFERED_MERCHANTS.has(merchant.id) || usedIds.merchantIds.has(merchant.id)),
    places: directory.places.filter((place) => !demoPlaceIds.has(place.id) || usedIds.placeIds.has(place.id)),
  }
}
