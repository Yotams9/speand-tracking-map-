import { describe, expect, it } from 'vitest'
import { reviewedAddressQuery } from './address-query'
describe('reviewed address search context', () => {
  it('includes the explicitly entered city and country with the street', () => {
    expect(reviewedAddressQuery('Fictional street 16', 'Fictional city', 'Israel')).toBe('Fictional street 16, Fictional city, Israel')
  })
  it('supports Hebrew fields without supplying facts', () => {
    expect(reviewedAddressQuery('רחוב בדוי 16', 'עיר בדויה', 'ישראל')).toBe('רחוב בדוי 16, עיר בדויה, ישראל')
  })
  it('does not duplicate context already present in a complete reviewed address', () => {
    expect(reviewedAddressQuery(' Fictional street 16, Fictional City, Israel ', 'fictional city', 'Israel')).toBe('Fictional street 16, Fictional City, Israel')
  })
  it('does not search for a city alone when the street is empty', () => {
    expect(reviewedAddressQuery(' ', 'Fictional city', 'Israel')).toBe('')
  })
  it('retains a complete free-form address when separate context is absent', () => {
    expect(reviewedAddressQuery('Fictional street 16, Fictional city, Israel')).toBe('Fictional street 16, Fictional city, Israel')
  })
})
