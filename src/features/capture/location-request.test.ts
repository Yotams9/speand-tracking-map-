import { describe, expect, it } from 'vitest'
import { locationRequests } from './location-request'

describe('device location reads', () => {
  it('only the latest read may apply its answer', () => {
    const reads = locationRequests()
    const first = reads.start(), second = reads.start()
    expect(reads.isCurrent(first)).toBe(false)
    expect(reads.isCurrent(second)).toBe(true)
  })
  it('an edit or closing the form makes a pending read stale', () => {
    const reads = locationRequests()
    const pending = reads.start()
    reads.cancel()
    expect(reads.isCurrent(pending)).toBe(false)
    // A new press after that is current again.
    expect(reads.isCurrent(reads.start())).toBe(true)
  })
})
