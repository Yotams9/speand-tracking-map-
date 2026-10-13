import { describe, expect, it } from 'vitest'
import { receiptEditorCurrency, receiptEditorDate, receiptEditorWall, receiptEditorUsesCollegeYear } from './receipt-editor-values'
import { receiptToReviewDraft, prepareReceiptReview, type ReceiptObservations } from './receipt-review-adapter'
import { createFixtureSpendscapeRepository } from '../../data/spendscape-repository'
const data = await createFixtureSpendscapeRepository().loadSnapshot()
const fixture = (): ReceiptObservations => ({ merchantName: 'Fictional corner shop', address: 'רחוב בדיוני 8',
  date: '29/02/2024', time: '09:07', currency: 'ש״ח', finalAmount: '10.05',
  lines: [{ name: 'מוצר בדוי', quantity: '2', unit: null, unitPrice: '5.00', lineAmount: '10.00' }] })

describe('explicit printed date/currency editor conversion', () => {
  it.each([['2024-02-29', '2024-02-29'], ['29/02/2024', '2024-02-29'], ['29-02-2024', '2024-02-29'],
    [' 03/04/2026 ', '2026-04-03'], ['01/01/1900', '1900-01-01'], ['31/12/2100', '2100-12-31']])('validates %s without locale or century guesses', (printed, iso) => {
    expect(receiptEditorDate(printed)).toBe(iso)
  })
  it.each([null, '', '29/02/2023', '29/02/1900', '29/02/2100', '31/04/2026', '00/01/2026', '01/00/2026',
    '01/13/2026', '2026-02-30', '2026-00-01', '01/01/1899', '01/01/2101', '09/30/2013',
    '1/2/2026', '01/02-2026', '2026/01/02', '2026-01-02T00:00Z', '01.02.2026', { candidates: ['01/02/2026','02/01/2026'] }])('leaves invalid/unsupported date %j unresolved', printed => {
    expect(receiptEditorDate(printed)).toBe('')
  })
  it.each([['30-09-26', '2026-09-30'], ['30/09/13', '2013-09-30'], ['01/01/00', '2000-01-01'],
    ['31-12-99', '2099-12-31'], ['29/02/00', '2000-02-29'], ['29-02-04', '2004-02-29']])('applies the explicit college century policy to %s', (printed, iso) => {
    expect(receiptEditorDate(printed)).toBe(iso)
    expect(receiptEditorUsesCollegeYear(printed)).toBe(true)
    expect(receiptEditorWall(printed, '15:47')).toBe(`${iso}T15:47`)
  })
  it.each(['29/02/01', '29/02/99', '31/04/26', '00/09/26', '30/00/26', '30/13/26',
    '30/09-26', '30.09.26', '30/09/026', '9/30/26', { candidates: ['30/09/26', '01/10/26'] }])('does not repair invalid or unsupported two-digit dates %j', printed => {
    expect(receiptEditorDate(printed)).toBe('')
    expect(receiptEditorUsesCollegeYear(printed)).toBe(false)
  })
  it.each(['30/09/1926', '30/09/2026', '2026-09-30'])('never applies the two-digit policy to four-digit %s', printed => {
    expect(receiptEditorUsesCollegeYear(printed)).toBe(false)
  })
  it.each(['00:00', '23:59', ' 09:07 '])('keeps explicitly observed clock %s without choosing a zone', time => {
    expect(receiptEditorWall('29/02/2024', time)).toBe(`2024-02-29T${time.trim()}`)
  })
  it.each([null, '', '9:07', '24:00', '09:60', '09:07:01', '09:07Z', '09:07+02:00', { candidates: ['09:07', '10:07'] }])('never fills/repairs time %j', time => {
    expect(receiptEditorWall('29/02/2024', time)).toBe('')
  })
  it('keeps missing/ambiguous date unresolved even when time is explicit', () => {
    expect(receiptEditorWall(null, '09:07')).toBe('')
    expect(receiptEditorWall({ candidates: ['2024-02-29', '2024-03-01'] }, '09:07')).toBe('')
  })
  it.each(['ILS', '₪', 'שח', 'ש"ח', 'ש״ח', 'ש”ח', 'ש“ח', "ש'ח", 'ש׳ח', ' ש״ח '])('maps only explicit ILS notation %s', printed => {
    expect(receiptEditorCurrency(printed)).toBe('ILS')
  })
  it.each(['USD', 'EUR', 'GBP', 'JPY'])('preserves supported ISO %s', currency => expect(receiptEditorCurrency(currency)).toBe(currency))
  it.each([null, '', '$', '€', 'ils', 'ISL', 'ש ח', 'ש"ח/USD', '₪ or USD', '10 ש״ח', 'NIS', 'ש״ח\u200f',
    { candidates: ['ILS', 'USD'] }, { candidates: ['ILS', 'ש״ח'] }])('does not infer currency from ambiguous/unknown %j', printed => {
    expect(receiptEditorCurrency(printed)).toBe('')
  })
  it('preserves observations, address and prices; explicit review still gates save', () => {
    const raw = fixture(), original = structuredClone(raw), draft = receiptToReviewDraft(raw)
    expect(draft.observations).toEqual(original)
    expect(draft.review.currency).toBe('ILS')
    expect(receiptEditorWall(draft.observations.date, draft.observations.time)).toBe('2024-02-29T09:07')
    expect(draft.review.date).toBe('') // wall-clock conversion never confirms an instant
    expect(draft.review.lines[0]).toMatchObject({ unit: '', price: '5.00', printedAmount: '10.00' })
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: false, errors: { date: 'date', 'unit-0': 'required' } })
    Object.assign(draft.review, { date: '2024-02-29T09:07', channel: 'unknown', merchantId: data.merchants[0].id, payment: 'cash', category: 'groceries' })
    draft.review.lines[0].unit = 'item' // explicit simulated user choice
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: true, input: { amount: '10.05' } })
    draft.review.lines[0].printedAmount = '9.99'
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: false, errors: { 'printedAmount-0': 'arithmetic' } })
    expect(draft.observations).toEqual(original)
  })
})
