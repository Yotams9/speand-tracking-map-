import { describe, expect, it } from 'vitest'
import { receiptToReviewDraft, prepareReceiptReview, type ReceiptObservations } from './receipt-review-adapter'
import { receiptReviewPrefill, receiptReviewZone } from './receipt-review-prefill'
const fixture = (): ReceiptObservations => ({merchantName:'Fictional merchant · חנות בדויה',address:'Fictional street 12',date:'30/09/2026',time:'15:57',currency:null,finalAmount:'12.40',lines:[{name:'Fictional product',quantity:'2',unit:'item',unitPrice:'6.25',lineAmount:'12.50'}]})
const draft = (o=fixture()) => receiptToReviewDraft(o)
describe('user-requested Israel review defaults, independent from observations',()=>{
 it('prefills only review values, preserves observations and amounts, invents no place',()=>{
  const d=draft(), before=structuredClone(d);const r=receiptReviewPrefill(d.review,d.observations)
  expect(receiptReviewZone).toBe('Asia/Jerusalem');expect(r.currency).toBe('ILS');expect(r.date).toBe('2026-09-30T12:57')
  expect(r.directoryIntent).toEqual({merchant:{name:d.observations.merchantName,category:'',separate:false}})
  expect(r.amount).toBe('12.40');expect(r.lines).toEqual(before.review.lines);expect(r.placeId).toBe('');expect(r.directoryIntent?.place).toBeUndefined();expect(d).toEqual(before)
 })
 it('requires explicit context, then retains strict per-line arithmetic and independent payable',()=>{
  const d=draft();d.review=receiptReviewPrefill(d.review,d.observations)
  expect(prepareReceiptReview(d,{merchants:[],places:[]}).ready).toBe(false)
  d.review.payment='unknown';d.review.category='unknown';d.review.directoryIntent!.merchant!.category='unknown'
  const result=prepareReceiptReview(d,{merchants:[],places:[]});expect(result.ready).toBe(true)
  if(result.ready){expect(result.input.amount).toBe('12.40');expect(result.input.lines[0].price).toBe('6.25')}
  d.review.lines[0].printedAmount='12.49';const bad=prepareReceiptReview(d,{merchants:[],places:[]});expect(bad.ready).toBe(false)
  if(!bad.ready)expect(bad.errors['printedAmount-0']).toBe('arithmetic')
 })
 it.each(['USD','EUR','ש"ח'])('preserves recognized currency %s',currency=>{const o={...fixture(),currency};const d=draft(o);expect(receiptReviewPrefill(d.review,d.observations).currency).toBe(d.review.currency)})
 it.each([{candidates:['ILS','USD']},'ambiguous notation'])('does not resolve ambiguous/unrecognized currency',currency=>{const d=draft({...fixture(),currency});expect(receiptReviewPrefill(d.review,d.observations).currency).toBe('')})
 it('does not replace an existing merchant choice, corrected review currency or timestamp',()=>{const d=draft();Object.assign(d.review,{merchantId:'explicit-existing',currency:'EUR',date:'2026-01-01T08:00'});const r=receiptReviewPrefill(d.review,d.observations);expect(r.directoryIntent).toBeUndefined();expect(r.merchantId).toBe('explicit-existing');expect(r.currency).toBe('EUR');expect(r.date).toBe('2026-01-01T08:00')})
 it.each([null,{candidates:['Merchant one','Merchant two']}])('keeps missing/ambiguous merchant unresolved',merchantName=>{const d=draft({...fixture(),merchantName});expect(receiptReviewPrefill(d.review,d.observations).directoryIntent).toBeUndefined()})
 it.each([{date:null,time:'15:57'},{date:'30/09/126',time:'15:57'},{date:'31/02/2026',time:'15:57'},{date:'30/09/2026',time:null},{date:'27/03/26',time:'02:30'},{date:'25/10/26',time:'01:30'}])('missing, invalid and DST-ambiguous wall time stays unresolved: %j',parts=>{const d=draft({...fixture(),...parts});expect(receiptReviewPrefill(d.review,d.observations).date).toBe('')})
 it('prefills the supported college date without retyping and leaves the printed two-digit observation unchanged',()=>{
  const d=draft({...fixture(),date:'30-09-26',time:'15:47'}), original=structuredClone(d)
  const r=receiptReviewPrefill(d.review,d.observations)
  expect(r.date).toBe('2026-09-30T12:47');expect(d.observations.date).toBe('30-09-26');expect(d).toEqual(original)
  expect(r.amount).toBe(original.review.amount);expect(r.lines).toEqual(original.review.lines);expect(r.placeId).toBe('')
 })
})
