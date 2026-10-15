import {describe, expect, it} from 'vitest'
import {minimalProbeRequest, PROBE_ENDPOINT, PROBE_MODEL} from '../../../qa/receipt-gemini-minimal/probe'
import {directRequest} from './direct-image-contract'
import {fictionalStructured, structuredCost, structuredEnvelope, structuredObservations, structuredRequest, structuredResponse, STRUCTURED_ENDPOINT, STRUCTURED_MODEL, STRUCTURED_PROMPT} from './structured-image-contract'
import {prepareReceiptReview, receiptToReviewDraft} from '../capture/receipt-review-adapter'
import {createFixtureSpendscapeRepository} from '../../data/spendscape-repository'

const data = await createFixtureSpendscapeRepository().loadSnapshot()
const raw = () => fictionalStructured('one')
const draft = () => {
  const d = receiptToReviewDraft(structuredResponse(structuredEnvelope(raw())))
  Object.assign(d.review, {merchantId: data.merchants[0].id, channel: 'unknown', payment: 'cash', category: 'groceries', date: '2026-10-04T07:20'})
  return d
}
describe('minimal-compatible structured candidate', () => {
  it('changes only instruction, output cap and documented JSON MIME from the successful minimal shape', () => {
    const baseline = minimalProbeRequest('image/png', 'YWJj'), request = structuredRequest('image/png', 'YWJj')
    baseline.contents[0].parts[0] = {text: STRUCTURED_PROMPT}
    expect(request).toEqual({...baseline, generationConfig: {maxOutputTokens: 4096, responseMimeType: 'application/json'}})
    expect(STRUCTURED_MODEL).toBe(PROBE_MODEL); expect(STRUCTURED_ENDPOINT).toBe(PROBE_ENDPOINT)
  })
  it('records every difference from the failed builder without speculating about causality', () => {
    const failed = directRequest('image/png', 'YWJj')
    expect(structuredRequest('image/png', 'YWJj')).toEqual({contents: [{parts: [{text: STRUCTURED_PROMPT}, failed.contents[0].parts[1]]}], generationConfig: {maxOutputTokens: 4096, responseMimeType: 'application/json'}})
    expect(failed.contents[0].role).toBe('user')
    expect(Object.keys(failed.generationConfig)).toEqual(['maxOutputTokens', 'responseFormat'])
  })
  it('has no reference answers, native transport, experimental thinking or provider schema', () => {
    expect(STRUCTURED_PROMPT).not.toMatch(/60[.,]5[05]|2013|30\/09|מינימרקט|f309579|seven units|five product/)
    expect(JSON.stringify(structuredRequest('image/jpeg', 'YWJj'))).not.toMatch(/responseFormat|responseSchema|thinkingConfig|tools|project|billing|role/)
  })
  it.each([['image/gif', 'YWJj'], ['image/png', ''], ['image/png', 'abc'], ['image/png', 'YWJj ']])('rejects invalid packaging %s %s', (mime, encoded) => expect(() => structuredRequest(mime, encoded)).toThrow())
  it('bounds input and expires pricing including thinking allowance', () => {
    expect(() => structuredRequest('image/png', 'Y'.repeat(5_592_412))).toThrow()
    expect(structuredCost(new Date('2026-10-09T12:00Z'))).toEqual({inputAllowance: 6240, generatedAllowance: 8192, estimatedUsd: 0.0354})
    for (const date of ['invalid', '2026-10-08', '2027-01-01']) expect(() => structuredCost(new Date(date))).toThrow('pricing-review-required')
  })
})
describe('strict proposed facts and existing review gate', () => {
  it.each(['one', 'fifteen'] as const)('retains every fictional %s row without changing numbers or labels', kind => {
    const o = fictionalStructured(kind), parsed = structuredResponse(structuredEnvelope(o))
    expect(parsed).toEqual(o); expect(parsed).not.toBe(o)
    expect(parsed.lines).toHaveLength(kind === 'one' ? 1 : 15)
    expect(receiptToReviewDraft(parsed).observations).toEqual(o)
  })
  it('permits unresolved required fields and absent optional VAT/barcode in an editable draft', () => {
    const o = raw(); o.date = o.time = o.currency = o.finalAmount = null; o.lines[0].unit = o.lines[0].unitPrice = null
    const d = receiptToReviewDraft(structuredResponse(structuredEnvelope(o)))
    expect(d.review).toMatchObject({date: '', currency: '', amount: '', merchantId: ''})
    expect(d.review.lines[0]).toMatchObject({unit: '', price: ''})
    expect(d.barcodes).toEqual([null]); expect(prepareReceiptReview(d, data).ready).toBe(false)
  })
  it('keeps original observations separate from deliberate corrections', () => {
    const d = draft(); d.review.lines[0].name = 'Reviewed fictional label'
    expect(d.observations.lines[0].name).toBe(raw().lines[0].name)
    expect(prepareReceiptReview(d, data).ready).toBe(true)
  })
  it('accepts an explicitly reviewed final payable difference without allocating it', () => {
    const d = draft(); const result = prepareReceiptReview(d, data)
    expect(result).toMatchObject({ready: true, input: {amount: '12.40', lines: [{price: '6.25', quantity: '2'}]}})
    expect(d.review.lines[0].printedAmount).toBe('12.50'); expect(d.review.lines[0]).not.toHaveProperty('discount')
  })
  it('preserves discounts and weighted quantities; per-line mismatches remain blocking', () => {
    const d = receiptToReviewDraft(structuredResponse(structuredEnvelope(fictionalStructured('fifteen'))))
    Object.assign(d.review, draft().review, {amount: '40.90', lines: d.review.lines})
    expect(d.review.lines[0]).toMatchObject({price: '3.25', quantity: '2', discount: '0.50', printedAmount: '6.00'})
    expect(d.review.lines[1]).toMatchObject({quantity: '0.375', unit: 'kg', price: '24.00'})
    expect(prepareReceiptReview(d, data).ready).toBe(true)
    d.review.lines[0].printedAmount = '6.01'
    expect(prepareReceiptReview(d, data)).toMatchObject({ready: false, errors: {'printedAmount-0': 'arithmetic'}})
  })
  it('keeps printed unknown barcode format transient and validates explicitly supplied identities', () => {
    const o = raw(); o.lines[0].barcode = {original: '4006381333931', format: null}
    expect(receiptToReviewDraft(structuredObservations(o)).barcodes).toEqual([null])
    o.lines[0].barcode.format = 'EAN13'
    expect(receiptToReviewDraft(structuredObservations(o)).barcodes[0]?.gtin14).toBe('04006381333931')
    o.lines[0].barcode.original = '4006381333932'
    expect(() => structuredObservations(o)).toThrow('ocr-invalid')
  })
  it.each(['-1', 'NaN', '1e3', '1.234', '1,000.00', 'private-secret-123'])('rejects malformed money %s without repairing it', value => {
    const o = raw(); o.lines[0].unitPrice = value
    expect(() => structuredResponse(structuredEnvelope(o))).toThrow(/^ocr-invalid$/)
  })
  it('rejects extra provider fields, sparse arrays and too many rows', () => {
    expect(() => structuredObservations({...raw(), secret: 'marker'})).toThrow('ocr-invalid')
    const o = raw(); delete o.lines[0]
    expect(() => structuredObservations(o)).toThrow('ocr-invalid')
    o.lines = Array.from({length: 51}, () => raw().lines[0]); expect(() => structuredObservations(o)).toThrow('ocr-invalid')
  })
  it.each(['MAX_TOKENS', 'SAFETY', 'RECITATION'])('rejects incomplete or refused output %s', finishReason => {
    const envelope = structuredEnvelope(raw()); envelope.candidates[0].finishReason = finishReason
    expect(() => structuredResponse(envelope)).toThrow(/^ocr-invalid$/)
  })
  it('rejects malformed, empty, oversized or multi-candidate output with a fixed error', () => {
    for (const response of [{}, {candidates: []}, {candidates: [...structuredEnvelope(raw()).candidates, ...structuredEnvelope(raw()).candidates]}, {candidates: [{finishReason: 'STOP', content: {parts: [{text: 'SYNTHETIC_SECRET'}]}}]}, {candidates: [{finishReason: 'STOP', content: {parts: [{text: 'X'.repeat(64001)}]}}]}]) expect(() => structuredResponse(response)).toThrow(/^ocr-invalid$/)
  })
  it('discards documented thought/signature metadata rather than rejecting or persisting it', () => {
    const text = JSON.stringify(raw())
    const result = structuredResponse({candidates: [{finishReason: 'STOP', content: {parts: [{thought: true, text: 'SYNTHETIC_PRIVATE_REASONING'}, {text, thoughtSignature: 'SYNTHETIC_OPAQUE_SECRET'}]}}]})
    expect(result).toEqual(raw()); expect(JSON.stringify(result)).not.toMatch(/PRIVATE_REASONING|OPAQUE_SECRET/)
    for (const part of [{text, thoughtSignature: 123}, {text, functionCall: {secret: 'marker'}}, {text, thought: 'false'}]) expect(() => structuredResponse({candidates: [{finishReason: 'STOP', content: {parts: [part]}}]})).toThrow(/^ocr-invalid$/)
  })
})
