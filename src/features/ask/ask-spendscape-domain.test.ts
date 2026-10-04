import { globePlaces, globePurchases, globeMerchants } from '../../data/spendscape-fixtures'
import { describe, expect, it } from 'vitest'
import { availableTimelineMonths } from '../../data/spendscape-globe'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import {
  describeAskAction,
  isAllowedAskAction,
  isAllowedAskActionPlan,
  parseAskCommand,
  type AskAction,
} from './ask-spendscape-domain'

const fixtureContext = {
  merchants: globeMerchants,
  places: globePlaces,
  purchases: globePurchases,
  timelineMonths: availableTimelineMonths(globePurchases),
}

describe('synthetic Ask Spendscape command parser', () => {
  it.each([
    ['en', 'Open latest purchase', 'Snapshot merchant', 'Open latest purchase · '],
    ['he', 'פתח את הרכישה האחרונה', 'בית עסק מהתמונה', 'פתיחת הרכישה האחרונה · '],
  ] as const)('uses only the supplied snapshot merchant name in %s', async (locale, command, name, prefix) => {
    const original = await fixtureSpendscapeRepository.loadSnapshot()
    const before = JSON.stringify(original)
    const snapshot = structuredClone(original)
    const latest = [...snapshot.purchases].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    const merchant = snapshot.merchants.find((candidate) => candidate.id === latest.merchantId)!
    const originalName = merchant.name[locale]
    merchant.name[locale] = name
    const context = { ...snapshot, timelineMonths: availableTimelineMonths(snapshot.purchases) }

    const result = parseAskCommand(command, locale, context)

    expect(result).toEqual({
      kind: 'single',
      action: { type: 'selection.openPurchase', purchaseId: latest.id },
      summary: `${prefix}${name}`,
    })
    if (result.kind !== 'single') throw new Error('Expected the existing latest-purchase command')
    expect(result.summary).not.toContain(originalName)
    expect(isAllowedAskAction(result.action, context)).toBe(true)
    expect(JSON.stringify(original)).toBe(before)
    expect(snapshot.purchases).toEqual(original.purchases)
    expect(snapshot.places).toEqual(original.places)
    expect(snapshot.evidence).toEqual(original.evidence)
    expect(parseAskCommand(command, locale, { ...context, merchants: [] })).toMatchObject({
      summary: `${prefix}${latest.id}`,
    })
  })

  it.each([
    ['Fly to Shuk Express Bograshov', 'map.flyToPlace'],
    ['Fly to Tel Aviv', 'map.flyToRegion'],
    ['Fit visible purchases', 'map.fitVisiblePurchases'],
    ['Reset globe', 'map.resetGlobe'],
    ['Show groceries', 'filters.set'],
    ['Clear filters', 'filters.clear'],
    ['Timeline 2026-08', 'timeline.setMonth'],
    ['Open purchases', 'purchases.open'],
    ['Open latest purchase', 'selection.openPurchase'],
    ['Open analytics categories', 'analytics.open'],
  ])('maps %s to the allowlisted %s action', (command, actionType) => {
    const result = parseAskCommand(command, 'en', fixtureContext)
    expect(result.kind).toBe('single')
    if (result.kind === 'single') {
      expect(result.action.type).toBe(actionType)
      expect(isAllowedAskAction(result.action, fixtureContext)).toBe(true)
    }
  })

  it('creates a confirmation-gated multi-action region plan', () => {
    const result = parseAskCommand('Show my purchases in Tel Aviv', 'en', fixtureContext)
    expect(result).toMatchObject({
      kind: 'plan',
      actions: [
        { type: 'filters.set', patch: { search: 'Tel Aviv' } },
        { type: 'map.flyToRegion', region: { kind: 'city', value: 'Tel Aviv' } },
      ],
    })
    if (result.kind === 'plan') expect(isAllowedAskActionPlan(result.actions, fixtureContext)).toBe(true)
  })

  it('offers bounded canonical candidates when a place phrase is ambiguous', () => {
    const result = parseAskCommand('Fly to market', 'en', fixtureContext)
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.candidates.map((candidate) => candidate.id)).toEqual([
        'place_rimon_park',
        'place_northline_mitte',
      ])
      expect(result.candidates.length).toBeLessThanOrEqual(4)
      expect(isAllowedAskActionPlan(result.candidates.map((candidate) => candidate.action), fixtureContext)).toBe(true)
    }
  })

  it('has bilingual equivalents for safe commands', () => {
    expect(parseAskCommand('טוס לתל אביב', 'he', fixtureContext)).toMatchObject({
      kind: 'single',
      action: { type: 'map.flyToRegion', region: { kind: 'city', value: 'Tel Aviv' } },
    })
    expect(parseAskCommand('הצג רכישות בתל אביב', 'he', fixtureContext)).toMatchObject({ kind: 'plan' })
    expect(parseAskCommand('פתח ניתוחים קטגוריות', 'he', fixtureContext)).toMatchObject({
      kind: 'single', action: { type: 'analytics.open', view: 'categories' },
    })
    const analytics = parseAskCommand('פתח ניתוחים קטגוריות', 'he', fixtureContext)
    if (analytics.kind === 'single') expect(analytics.summary).toContain('קטגוריות')
  })

  it('rejects destructive and external operations even when phrased as commands', () => {
    expect(parseAskCommand('Delete my latest purchase', 'en', fixtureContext)).toMatchObject({ kind: 'unsupported' })
    expect(parseAskCommand('Upload a receipt and run OCR', 'en', fixtureContext)).toMatchObject({ kind: 'unsupported' })
    expect(parseAskCommand('Connect my Gmail account', 'en', fixtureContext)).toMatchObject({ kind: 'unsupported' })
    expect(parseAskCommand('מחק את הרכישה האחרונה', 'he', fixtureContext)).toMatchObject({ kind: 'unsupported' })
  })

  it('rejects canonical IDs and months that do not exist', () => {
    expect(parseAskCommand('Open purchase not-real', 'en', fixtureContext)).toMatchObject({ kind: 'invalid' })
    expect(parseAskCommand('Timeline 2024-01', 'en', fixtureContext)).toMatchObject({ kind: 'invalid' })
    expect(parseAskCommand('Fly to Atlantis', 'en', fixtureContext)).toMatchObject({ kind: 'invalid' })
  })

  it('never emits a non-allowlisted action and keeps descriptions local', () => {
    const actions: AskAction[] = [
      { type: 'map.flyToPlace', placeId: globePlaces[0].id },
      { type: 'map.flyToRegion', region: { kind: 'country', value: 'Israel' } },
      { type: 'map.fitVisiblePurchases' },
      { type: 'map.resetGlobe' },
      { type: 'filters.set', patch: { currency: 'USD' } },
      { type: 'filters.clear' },
      { type: 'timeline.setMonth', month: '2026-08' },
      { type: 'purchases.open' },
      { type: 'selection.openPurchase', purchaseId: globePurchases[0].id },
      { type: 'analytics.open', view: 'currencies' },
    ]
    for (const action of actions) {
      expect(isAllowedAskAction(action, fixtureContext)).toBe(true)
      expect(describeAskAction(action, 'en', fixtureContext).length).toBeGreaterThan(3)
      expect(describeAskAction(action, 'he', fixtureContext).length).toBeGreaterThan(3)
      expect(isAllowedAskAction({ ...action, extra: true }, fixtureContext)).toBe(false)
      for (const key of Object.keys(action)) {
        const missingField = { ...action } as Record<string, unknown>
        delete missingField[key]
        expect(isAllowedAskAction(missingField, fixtureContext)).toBe(false)
      }
    }
    expect(isAllowedAskAction({ type: 'purchase.delete', purchaseId: globePurchases[0].id }, fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan(actions, fixtureContext)).toBe(true)
  })

  it.each([
    ['nonexistent place', { type: 'map.flyToPlace', placeId: 'place_not_real' }],
    ['invalid region kind', { type: 'map.flyToRegion', region: { kind: 'district', value: 'Tel Aviv' } }],
    ['nonexistent region', { type: 'map.flyToRegion', region: { kind: 'city', value: 'Atlantis' } }],
    ['invalid category', { type: 'filters.set', patch: { category: 'services' } }],
    ['invalid currency', { type: 'filters.set', patch: { currency: 'BTC' } }],
    ['invalid channel', { type: 'filters.set', patch: { channel: 'telephone' } }],
    ['invalid date range', { type: 'filters.set', patch: { dateRange: 'forever' } }],
    ['non-string search', { type: 'filters.set', patch: { search: 42 } }],
    ['empty filter patch', { type: 'filters.set', patch: {} }],
    ['unexpected filter field', { type: 'filters.set', patch: { currency: 'USD', merchantId: 'merchant_shuk' } }],
    ['nonexistent month', { type: 'timeline.setMonth', month: '2024-01' }],
    ['nonexistent purchase', { type: 'selection.openPurchase', purchaseId: 'purchase_not_real' }],
    ['invalid analytics view', { type: 'analytics.open', view: 'merchants' }],
    ['missing place id', { type: 'map.flyToPlace' }],
    ['missing region', { type: 'map.flyToRegion' }],
    ['missing patch', { type: 'filters.set' }],
    ['missing timeline month', { type: 'timeline.setMonth' }],
    ['missing purchase id', { type: 'selection.openPurchase' }],
    ['missing analytics view', { type: 'analytics.open' }],
    ['unexpected top-level value', { type: 'map.resetGlobe', force: true }],
    ['malformed action', { type: 7 }],
    ['null action', null],
    ['undefined action', undefined],
    ['array action', [{ type: 'map.resetGlobe' }]],
    ['null place id', { type: 'map.flyToPlace', placeId: null }],
    ['numeric purchase id', { type: 'selection.openPurchase', purchaseId: 1 }],
    ['null region', { type: 'map.flyToRegion', region: null }],
    ['missing region value', { type: 'map.flyToRegion', region: { kind: 'city' } }],
    ['extra region field', { type: 'map.flyToRegion', region: { kind: 'city', value: 'Tel Aviv', bounds: [] } }],
    ['wrong region value type', { type: 'map.flyToRegion', region: { kind: 'city', value: ['Tel Aviv'] } }],
    ['null patch', { type: 'filters.set', patch: null }],
    ['array patch', { type: 'filters.set', patch: [] }],
    ['undefined patch value', { type: 'filters.set', patch: { category: undefined } }],
    ['object patch value', { type: 'filters.set', patch: { currency: { code: 'USD' } } }],
    ['malformed month', { type: 'timeline.setMonth', month: 202608 }],
    ['null analytics view', { type: 'analytics.open', view: null }],
  ])('rejects malformed runtime action: %s', (_label, action) => {
    expect(isAllowedAskAction(action, fixtureContext)).toBe(false)
  })

  it('rejects malformed plans atomically before any action can execute', () => {
    const valid = { type: 'map.resetGlobe' }
    const invalid = { type: 'filters.set', patch: { currency: 'BTC' } }
    expect(isAllowedAskActionPlan([], fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan([valid, invalid], fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan('map.resetGlobe', fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan([valid, undefined], fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan(new Array(1), fixtureContext)).toBe(false)
    expect(isAllowedAskActionPlan(Object.assign([valid], { extra: true }), fixtureContext)).toBe(false)
  })

  it('rejects inherited fields, accessors, and unexpected symbol keys', () => {
    expect(isAllowedAskAction(Object.create({ type: 'map.resetGlobe' }), fixtureContext)).toBe(false)
    expect(isAllowedAskAction({ type: 'map.resetGlobe', [Symbol('extra')]: true }, fixtureContext)).toBe(false)
    let reads = 0
    const accessor = { get type() { reads += 1; return 'map.resetGlobe' } }
    expect(isAllowedAskAction(accessor, fixtureContext)).toBe(false)
    expect(reads).toBe(0)
  })

  it('accepts every filter enum, analytics view, nullable month, and free-text search', () => {
    const filters = {
      category: ['all', 'groceries', 'food', 'retail', 'travel'],
      currency: ['all', 'ILS', 'EUR', 'GBP', 'USD', 'JPY', 'AUD', 'MXN', 'ZAR'],
      channel: ['all', 'physical', 'online', 'cash-manual', 'unresolved'],
      dateRange: ['all', '30d', '90d', 'year'],
      search: ['', 'תל אביב', 'long local search'],
    }
    for (const [key, values] of Object.entries(filters)) {
      for (const value of values) expect(isAllowedAskAction({ type: 'filters.set', patch: { [key]: value } }, fixtureContext)).toBe(true)
    }
    for (const view of ['overview', 'timeline', 'channels', 'categories', 'places', 'currencies']) {
      expect(isAllowedAskAction({ type: 'analytics.open', view }, fixtureContext)).toBe(true)
    }
    expect(isAllowedAskAction({ type: 'timeline.setMonth', month: null }, fixtureContext)).toBe(true)
    expect(isAllowedAskAction({ type: 'filters.set', patch: { search: 'Tel Aviv', currency: 'ILS', channel: 'physical' } }, fixtureContext)).toBe(true)
  })

  it('validates canonical arguments against the live session context, not a stale default graph', () => {
    const sessionPurchase = { ...globePurchases[0], id: 'session_purchase_test', timestamp: '2026-09-01T12:00:00Z' }
    const context = {
      merchants: globeMerchants,
      places: [globePlaces[0]],
      purchases: [sessionPurchase],
      timelineMonths: availableTimelineMonths([sessionPurchase]),
    }
    expect(isAllowedAskAction({ type: 'selection.openPurchase', purchaseId: sessionPurchase.id }, context)).toBe(true)
    expect(isAllowedAskAction({ type: 'selection.openPurchase', purchaseId: globePurchases[0].id }, context)).toBe(false)
    expect(isAllowedAskAction({ type: 'timeline.setMonth', month: '2026-09' }, context)).toBe(true)
    expect(isAllowedAskAction({ type: 'timeline.setMonth', month: '2026-08' }, context)).toBe(false)
    expect(isAllowedAskAction({ type: 'map.flyToPlace', placeId: globePlaces[1].id }, context)).toBe(false)
    expect(isAllowedAskAction({ type: 'map.flyToRegion', region: { kind: 'city', value: globePlaces[0].city.en } }, context)).toBe(true)
    expect(isAllowedAskAction({ type: 'map.flyToRegion', region: { kind: 'country', value: 'Atlantis' } }, context)).toBe(false)
  })
})
