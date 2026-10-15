import { describe, expect, it } from 'vitest'
import { receiptTimeCandidates } from './receipt-review-time'
describe('explicit receipt wall-clock confirmation', () => {
  it('converts Jerusalem summer time without modifying printed facts', () => {
    expect(receiptTimeCandidates('2026-10-03T09:15', 'Asia/Jerusalem')).toEqual(['2026-10-03T06:15'])
    expect(receiptTimeCandidates('2026-01-03T09:15', 'Asia/Jerusalem')).toEqual(['2026-01-03T07:15'])
  })
  it('supports an explicitly chosen UTC or device zone, fractional offsets', () => {
    expect(receiptTimeCandidates('2026-10-03T09:15', 'UTC')).toEqual(['2026-10-03T09:15'])
    expect(receiptTimeCandidates('2026-10-03T09:15', 'Asia/Kathmandu')).toEqual(['2026-10-03T03:30'])
  })
  it('rejects DST gaps and exposes both overlap occurrences', () => {
    expect(receiptTimeCandidates('2026-03-08T02:30', 'America/New_York')).toEqual([])
    expect(receiptTimeCandidates('2026-11-01T01:30', 'America/New_York')).toEqual(['2026-11-01T05:30', '2026-11-01T06:30'])
  })
  it.each(['', '2026-10-03T', 'T09:15', '2026-02-30T09:15', '2026-10-03T25:15', '2026-10-03T09:15Z', '1800-01-01T00:00'])('never repairs or fills %s', wall => {
    expect(receiptTimeCandidates(wall, 'UTC')).toEqual([])
  })
  it('requires a supported explicit timezone', () => {
    expect(receiptTimeCandidates('2026-10-03T09:15', '')).toEqual([])
    expect(receiptTimeCandidates('2026-10-03T09:15', 'invented')).toEqual([])
  })
})
