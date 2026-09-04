import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPlaceFeatureCollection, defaultPurchaseQuery, filterPurchases, globePurchases, smartInboxCases, type GlobePurchase } from '../../data/spendscape-globe'
import { combineSessionPurchases, createSessionCaptureRecord, demoDraftForSource } from '../capture/capture-domain'
import { applySmartInboxDecisions } from '../inbox/smart-inbox-domain'
import { deriveReplayEvents, initialReplayState, isReplayRange, ReplayClock, replayPlace, replayReducer } from './life-replay-domain'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('canonical Replay projection', () => {
  it('projects the composed Capture/Inbox graph without duplicating nested purchases or pins', () => {
    const record = createSessionCaptureRecord(demoDraftForSource('receipt')!, 1)
    const composed = applySmartInboxDecisions(combineSessionPurchases(globePurchases, [record]), smartInboxCases, [
      { caseId: smartInboxCases[0].id, status: 'resolved', placeId: 'place_shuk_bograshov' },
    ])
    const before = JSON.stringify(composed)
    const events = deriveReplayEvents(composed)
    expect(events.map((purchase) => purchase.id).sort()).toEqual(composed.map((purchase) => purchase.id).sort())
    expect(events.filter((purchase) => purchase.id === record.purchase.id)).toHaveLength(1)
    expect(replayPlace(events.find((purchase) => purchase.id === smartInboxCases[0].purchaseId))?.id).toBe('place_shuk_bograshov')
    expect(buildPlaceFeatureCollection(undefined, events).features).toHaveLength(12)
    expect(JSON.stringify(composed)).toBe(before)
  })
  it('contains exactly the shared-filter purchase IDs, without mutating the graph', () => {
    for (const query of [defaultPurchaseQuery, { ...defaultPurchaseQuery, channel: 'online' as const }, { ...defaultPurchaseQuery, search: 'Tokyo' }]) {
      const scope = filterPurchases(query)
      const before = JSON.stringify(scope)
      expect(deriveReplayEvents(scope).map((p) => p.id).sort()).toEqual(scope.map((p) => p.id).sort())
      expect(JSON.stringify(scope)).toBe(before)
    }
  })
  it('uses timestamp then binary canonical ID, including equal timestamps with differing offsets', () => {
    const purchase = globePurchases[0]
    const input = [
      { ...purchase, id: 'z', timestamp: '2026-08-01T12:00:00Z' },
      { ...purchase, id: 'a', timestamp: '2026-08-01T14:00:00+02:00' },
      { ...purchase, id: 'first', timestamp: '2026-07-31T23:59:59Z' },
    ]
    expect(deriveReplayEvents(input).map((p) => p.id)).toEqual(['first', 'a', 'z'])
    expect(deriveReplayEvents(input.reverse()).map((p) => p.id)).toEqual(['first', 'a', 'z'])
  })
  it('uses inclusive UTC calendar boundaries and rejects invalid dates/ranges', () => {
    const input = ['2026-07-31T23:59:59Z', '2026-08-01T00:00:00Z', '2026-08-01T23:59:59.999Z', '2026-08-02T00:00:00Z']
      .map((timestamp, i) => ({ ...globePurchases[0], id: String(i), timestamp }))
    expect(deriveReplayEvents(input, { start: '2026-08-01', end: '2026-08-01' }).map((p) => p.id)).toEqual(['1', '2'])
    for (const range of [{ start: '2026-02-30', end: '' }, { start: '2026-08-02', end: '2026-08-01' }, { start: 'NaN', end: '' }]) {
      expect(isReplayRange(range)).toBe(false)
      expect(deriveReplayEvents(input, range)).toEqual([])
    }
  })
  it('keeps original amounts/items and excludes online/unresolved only from geography', () => {
    const events = deriveReplayEvents(globePurchases)
    expect(events).toHaveLength(globePurchases.length)
    for (const purchase of events) {
      expect(purchase).toBe(globePurchases.find((p) => p.id === purchase.id))
      if (purchase.channel !== 'physical' || purchase.resolution !== 'confirmed') expect(replayPlace(purchase)).toBeUndefined()
    }
    const repeated = events.filter((p) => p.placeId === 'place_shuk_bograshov')
    expect(repeated.length).toBeGreaterThan(1)
    expect(buildPlaceFeatureCollection(undefined, repeated).features).toHaveLength(1)
    expect(new Set(repeated.map((p) => replayPlace(p)?.id)).size).toBe(1)
    expect(replayPlace({ ...events[0], placeId: 'missing' } as GlobePurchase)).toBeUndefined()
  })
})

describe('bounded Replay transport', () => {
  it('rejects an already-queued callback after cancellation or replacement', () => {
    const callbacks: (() => void)[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      callbacks.push(callback)
      return callbacks.length
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {})
    const clock = new ReplayClock()
    const advance = vi.fn()
    clock.schedule(1, advance)
    clock.cancel()
    callbacks[0]()
    clock.schedule(1, advance)
    clock.schedule(2, advance)
    callbacks[1]()
    expect(advance).not.toHaveBeenCalled()
    callbacks[2]()
    expect(advance).toHaveBeenCalledTimes(1)
  })
  it('opens paused, handles empty/single/completion, never loops automatically', () => {
    expect(replayReducer(initialReplayState, { type: 'play' }, 0)).toBe(initialReplayState)
    const play = replayReducer(initialReplayState, { type: 'play' }, 1)
    const complete = replayReducer(play, { type: 'tick' }, 1)
    expect(complete.status).toBe('complete')
    expect(replayReducer(complete, { type: 'tick' }, 1)).toBe(complete)
    expect(replayReducer(complete, { type: 'play' }, 1)).toEqual(play)
  })
  it('pauses/resumes at the current event, seeks paused and validates speed/index', () => {
    let state = replayReducer(initialReplayState, { type: 'play' }, 3)
    state = replayReducer(state, { type: 'tick' }, 3)
    state = replayReducer(state, { type: 'pause' }, 3)
    expect(replayReducer(state, { type: 'tick' }, 3)).toBe(state)
    expect(replayReducer(state, { type: 'play' }, 3).index).toBe(1)
    expect(replayReducer(state, { type: 'seek', index: 2 }, 3)).toMatchObject({ index: 2, status: 'paused' })
    for (const index of [-1, 3, NaN, 0.5]) expect(replayReducer(state, { type: 'seek', index }, 3)).toBe(state)
    for (const speed of [0, 4, NaN]) expect(replayReducer(state, { type: 'speed', speed }, 3)).toBe(state)
    for (const speed of [0.5, 1, 2]) expect(replayReducer(state, { type: 'speed', speed }, 3).speed).toBe(speed)
  })
  it.each([0.5, 1, 2] as const)('advances once at speed %s, cancels pause/range/exit callbacks', (speed) => {
    vi.useFakeTimers()
    const clock = new ReplayClock()
    const advance = vi.fn()
    clock.schedule(speed, advance)
    vi.advanceTimersByTime(4000 / speed - 1)
    expect(advance).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(advance).toHaveBeenCalledTimes(1)
    clock.schedule(speed, advance)
    clock.cancel()
    vi.advanceTimersByTime(20_000)
    expect(advance).toHaveBeenCalledTimes(1)
    clock.schedule(speed, advance)
    clock.schedule(speed, advance)
    vi.advanceTimersByTime(20_000)
    expect(advance).toHaveBeenCalledTimes(2)
  })
})
