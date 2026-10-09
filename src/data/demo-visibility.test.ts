import { describe, expect, it } from 'vitest'
import { DEMO_DATA_KEY, LOCALE_KEY, demoStory, offeredDirectory, readDemoPreference, readLocalePreference, writeDemoPreference, writeLocalePreference } from './demo-visibility'
import { fixtureSpendscapeRepository } from './spendscape-repository'
import type { Merchant, Place } from './spendscape-globe'

const memory = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial))
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, values }
}
const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }

describe('demo data preference', () => {
  it('is off unless the person turned it on', () => {
    expect(readDemoPreference(memory())).toBe(false)
    expect(readDemoPreference(memory({ [DEMO_DATA_KEY]: 'off' }))).toBe(false)
    expect(readDemoPreference(memory({ [DEMO_DATA_KEY]: 'yes' }))).toBe(false)
    expect(readDemoPreference(memory({ [DEMO_DATA_KEY]: 'on' }))).toBe(true)
    expect(readDemoPreference(null)).toBe(false)
    expect(readDemoPreference(blocked)).toBe(false)
  })
  it('remembers the choice and survives blocked storage', () => {
    const storage = memory()
    writeDemoPreference(storage, true)
    expect(storage.values.get(DEMO_DATA_KEY)).toBe('on')
    writeDemoPreference(storage, false)
    expect(readDemoPreference(storage)).toBe(false)
    expect(() => writeDemoPreference(blocked, true)).not.toThrow()
  })
})

describe('language preference', () => {
  it('accepts only known languages', () => {
    expect(readLocalePreference(memory())).toBeNull()
    expect(readLocalePreference(memory({ [LOCALE_KEY]: 'fr' }))).toBeNull()
    expect(readLocalePreference(memory({ [LOCALE_KEY]: 'en' }))).toBe('en')
    expect(readLocalePreference(blocked)).toBeNull()
    const storage = memory()
    writeLocalePreference(storage, 'he')
    expect(readLocalePreference(storage)).toBe('he')
  })
})

describe('demo story visibility', async () => {
  const snapshot = await fixtureSpendscapeRepository.loadSnapshot()
  it('hides demo purchases, evidence and inbox questions by default', () => {
    expect(demoStory(snapshot, false)).toEqual({ purchases: [], evidence: [], smartInboxCases: [] })
  })
  it('returns the unchanged demo story when turned on', () => {
    const story = demoStory(snapshot, true)
    expect(story.purchases).toBe(snapshot.purchases)
    expect(story.evidence).toBe(snapshot.evidence)
    expect(story.smartInboxCases).toBe(snapshot.smartInboxCases)
    expect(story.purchases).toHaveLength(42)
  })
})

describe('stores offered in the purchase form', async () => {
  const snapshot = await fixtureSpendscapeRepository.loadSnapshot()
  const demoMerchants = new Set(snapshot.merchants.map((merchant) => merchant.id))
  const demoPlaces = new Set(snapshot.places.map((place) => place.id))
  const own: Merchant = { id: 'chain_shufersal', name: { en: 'Shufersal', he: 'שופרסל' }, category: 'groceries' }
  const ownPlace: Place = { id: 'store_shufersal_1', merchantId: own.id, name: own.name, branch: { en: 'A', he: 'A' }, city: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, country: { en: 'Israel', he: 'ישראל' }, coordinates: [34.77, 32.08], category: 'groceries' }
  const directory = { merchants: [...snapshot.merchants, own], places: [...snapshot.places, ownPlace] }
  const unused = { merchantIds: new Set<string>(), placeIds: new Set<string>() }

  it('offers everything with demo data on', () => {
    expect(offeredDirectory(directory, demoMerchants, demoPlaces, unused, true)).toBe(directory)
  })
  it('leaves fictional demo stores out with demo data off, keeping the person’s own stores', () => {
    const offered = offeredDirectory(directory, demoMerchants, demoPlaces, unused, false)
    expect(offered.places.map((place) => place.id)).toEqual(['store_shufersal_1'])
    expect(offered.merchants.map((merchant) => merchant.id)).toEqual(['merchant_unresolved', 'chain_shufersal'])
  })
  it('keeps a demo store that a saved purchase already uses', () => {
    const place = snapshot.places[0]
    const offered = offeredDirectory(directory, demoMerchants, demoPlaces, { merchantIds: new Set([place.merchantId]), placeIds: new Set([place.id]) }, false)
    expect(offered.places.map((entry) => entry.id)).toEqual([place.id, 'store_shufersal_1'])
    expect(offered.merchants.map((entry) => entry.id)).toContain(place.merchantId)
  })
})
