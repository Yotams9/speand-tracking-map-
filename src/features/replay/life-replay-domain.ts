import type { GlobePurchase, Place } from '../../data/spendscape-globe'

export interface ReplayRange { start: string; end: string }
export type ReplaySpeed = 0.5 | 1 | 2
export type ReplayStatus = 'paused' | 'playing' | 'complete'
export interface ReplayState { index: number; status: ReplayStatus; speed: ReplaySpeed }
export type ReplayAction =
  | { type: 'play' } | { type: 'pause' } | { type: 'tick' }
  | { type: 'seek'; index: number } | { type: 'speed'; speed: number } | { type: 'reset' }

export const initialReplayState: ReplayState = { index: 0, status: 'paused', speed: 1 }
export const emptyReplayRange: ReplayRange = { start: '', end: '' }

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function isReplayRange(range: ReplayRange): boolean {
  return (!range.start || isDate(range.start)) && (!range.end || isDate(range.end)) &&
    (!range.start || !range.end || range.start <= range.end)
}

/** A derived view of the already-filtered graph, never another purchase store. */
export function deriveReplayEvents(purchases: readonly GlobePurchase[], range: ReplayRange = emptyReplayRange) {
  if (!isReplayRange(range)) return []
  const start = range.start ? Date.parse(`${range.start}T00:00:00Z`) : -Infinity
  const end = range.end ? Date.parse(`${range.end}T00:00:00Z`) + 86_400_000 : Infinity
  return purchases.filter((purchase) => {
    const time = Date.parse(purchase.timestamp)
    return Number.isFinite(time) && time >= start && time < end
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function replayPlace(purchase: GlobePurchase | undefined, places: readonly Place[]) {
  if (!purchase || purchase.channel !== 'physical' || purchase.resolution !== 'confirmed') return undefined
  return places.find((place) => place.id === purchase.placeId)
}

export function replayReducer(state: ReplayState, action: ReplayAction, count: number): ReplayState {
  switch (action.type) {
    case 'play': return count ? { ...state, index: state.status === 'complete' ? 0 : state.index, status: 'playing' } : state
    case 'pause': return state.status === 'playing' ? { ...state, status: 'paused' } : state
    case 'tick': return state.status !== 'playing' ? state : state.index + 1 < count
      ? { ...state, index: state.index + 1 } : { ...state, status: 'complete' }
    case 'seek': return Number.isInteger(action.index) && action.index >= 0 && action.index < count
      ? { ...state, index: action.index, status: 'paused' } : state
    case 'speed': return [0.5, 1, 2].includes(action.speed)
      ? { ...state, speed: action.speed as ReplaySpeed } : state
    case 'reset': return { ...state, index: 0, status: 'paused' }
  }
}

/** Single cancellable presentation clock. Generation also rejects already-queued callbacks. */
export class ReplayClock {
  private timer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  schedule(speed: ReplaySpeed, advance: () => void) {
    this.cancel()
    const generation = this.generation
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return
      this.timer = undefined
      advance()
    }, 4000 / speed)
  }
  cancel() {
    this.generation += 1
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}
