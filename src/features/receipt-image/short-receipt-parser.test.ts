import {describe,it,expect} from 'vitest'
import {parseVisionReceipt} from './short-receipt-parser'
import {fictionalShortOcr} from './vision-fixtures'
import {fictionalOcr} from './ocr-fixtures'
import {receiptToReviewDraft,prepareReceiptReview} from '../capture/receipt-review-adapter'
import {fixtureSpendscapeRepository} from '../../data/spendscape-repository'
describe('relative short printed receipt layout',()=>{
  it.each([1,15])('preserves %s lines and unresolved facts without IDs, currency or units',async count=>{const doc=fictionalShortOcr(count),before=structuredClone(doc),r=parseVisionReceipt(doc);expect(r.observations).toMatchObject({merchantName:'בית בדוי',address:'Imaginary Street 8',date:'04-10-26',time:'10:35',currency:null,finalAmount:(count*7.5).toFixed(2)});expect(r.observations.lines).toHaveLength(count);expect(r.observations.lines[0]).toEqual({name:'מוצר בדוי',quantity:'3',unit:null,unitPrice:'2.50',lineAmount:'7.50'});expect(doc).toEqual(before);const draft=receiptToReviewDraft(r.observations);expect(prepareReceiptReview(draft,await fixtureSpendscapeRepository.loadSnapshot()).ready).toBe(false)})
  it('preserves existing explicit table discounts and fully discounted lines',()=>{const doc=fictionalOcr('fifteen');expect(parseVisionReceipt(doc).observations).toEqual(parseVisionReceipt(structuredClone(doc)).observations);expect(parseVisionReceipt(doc).observations.lines[0].discount).toBe('0.50')})
  it('uses translated/scaled geometry with no reference answer',()=>{const doc=fictionalShortOcr();doc.width=2000;doc.height=2000;doc.words=doc.words.map(w=>({...w,x:w.x*1.5+100,y:w.y*1.5+50,width:w.width*1.5,height:w.height*1.5}));const item=doc.words.find(w=>w.text==='7.50')!;item.text='7.49';expect(parseVisionReceipt(doc).observations.lines[0].lineAmount).toBe('7.49')})
  it('leaves competing totals as candidates rather than repairing',()=>{const doc=fictionalShortOcr();const total=doc.words.filter(w=>w.y===425);doc.words.push(...total.map(w=>({...w,y:465,text:w.text==='7.50'?'7.49':w.text})));expect(parseVisionReceipt(doc).observations.finalAmount).toEqual({candidates:['7.50','7.49']})})
  it('rejects neighboring number ambiguity, preserves malformed singleton',()=>{const doc=fictionalShortOcr(),w=doc.words.find(w=>w.text==='2.50')!;doc.words.push({...w,x:620,text:'99'});expect(parseVisionReceipt(doc).observations.lines[0].unitPrice).toBeNull()})
  it('does not infer optional VAT, discount, units, currency or barcode',()=>{const r=parseVisionReceipt(fictionalShortOcr());expect(r.observations.lines[0]).not.toHaveProperty('barcode');expect(r.observations.lines[0]).not.toHaveProperty('discount');expect(r.observations).not.toHaveProperty('vatAmount');expect(r.observations.currency).toBeNull()})
  it('rejects missing/competing headers, missing numeric row and unsupported layouts',()=>{for(const kind of ['header','row','repeated']){const doc=fictionalShortOcr();if(kind==='header')doc.words=doc.words.filter(w=>w.text!=='כמות');if(kind==='row')doc.words=doc.words.filter(w=>w.y!==288);if(kind==='repeated')doc.words.push(...doc.words.filter(w=>w.y===180).map(w=>({...w,y:700})));expect(()=>parseVisionReceipt(doc)).toThrow('layout-unsupported')}})
  it('reconstructs adjacent printed total fragments without dropping characters', () => {
    const doc = fictionalShortOcr()
    const total = doc.words.find(w => w.y === 425 && w.text === '7.50')!
    total.text = '7.'; total.width = 16
    doc.words.push({ ...total, text: '50', x: 78, width: 16 })
    expect(parseVisionReceipt(doc).observations.finalAmount).toBe('7.50')
  })
  it.each(['O.50', '99', '7.49'])('retains competing total evidence %s as unresolved', text => {
    const doc = fictionalShortOcr()
    doc.words.push({ text, x: 145, y: 425, width: 40, height: 20 })
    expect(parseVisionReceipt(doc).observations.finalAmount).toBeNull()
  })
  it('preserves malformed single totals and rejects distant fragments or crossing boxes', () => {
    const doc = fictionalShortOcr()
    const total = doc.words.find(w => w.y === 425 && w.text === '7.50')!
    total.text = 'O.50'
    expect(parseVisionReceipt(doc).observations.finalAmount).toBe('O.50')
    total.text = '7.'; total.width = 16
    doc.words.push({ ...total, text: '50', x: 145 })
    expect(parseVisionReceipt(doc).observations.finalAmount).toBeNull()
    doc.words.pop()
    doc.words.push({ ...total, text: '99', x: 540, width: 30 })
    expect(parseVisionReceipt(doc).observations.finalAmount).toBeNull()
  })
  it('does not mask an unresolved repeated payable total', () => {
    const doc = fictionalShortOcr()
    doc.words.push(...doc.words.filter(w => w.y === 425).map(w => ({ ...w, y: 465, text: w.text === '7.50' ? '7.' : w.text })))
    doc.words.push({ text: '50', x: 145, y: 465, width: 16, height: 20 })
    expect(parseVisionReceipt(doc).observations.finalAmount).toBeNull()
  })
  it.each(['USD', 'ILS', 'EUR', 'GBP', '₪'])('does not use product/internal-code text %s as currency', text => {
    const doc = fictionalShortOcr()
    doc.words.find(w => w.y === 260 && w.text === 'בדוי')!.text = text
    doc.words.find(w => w.y === 260 && w.text === '800000')!.text = text
    expect(parseVisionReceipt(doc).observations.currency).toBeNull()
  })
  it.each(['Currency:', 'מטבע:'])('accepts only explicit currency header %s and rejects conflicting/malformed repeats', key => {
    const doc = fictionalShortOcr()
    doc.words.push({ text: key, x: 600, y: 140, width: 90, height: 20 }, { text: 'ILS', x: 500, y: 140, width: 24, height: 20 })
    expect(parseVisionReceipt(doc).observations.currency).toBe('ILS')
    doc.words.push({ text: key, x: 800, y: 140, width: 90, height: 20 })
    expect(parseVisionReceipt(doc).observations.currency).toBeNull()
  })
  it.each(['04-10-26', '2026-10-04', '04/10/2026', '10:35', '123456'])('excludes standalone date/time/identifier %s from merchant and address', text => {
    const doc = fictionalShortOcr()
    doc.words = doc.words.filter(w => w.y !== 20 && w.y !== 60)
    doc.words.push({ text, x: 580, y: 20, width: 120, height: 20 }, { text, x: 580, y: 60, width: 120, height: 20 })
    const result = parseVisionReceipt(doc).observations
    expect(result.merchantName).toBeNull(); expect(result.address).toBeNull()
  })
  it('excludes segmented date headers without shifting another row into merchant', () => {
    const doc = fictionalShortOcr()
    doc.words = doc.words.filter(w => w.y !== 20)
    doc.words.push({ text: '04-', x: 580, y: 20, width: 24, height: 20 }, { text: '10-', x: 606, y: 20, width: 24, height: 20 }, { text: '26', x: 632, y: 20, width: 16, height: 20 })
    const result = parseVisionReceipt(doc).observations
    expect(result.merchantName).toBeNull(); expect(result.address).toBe('Imaginary Street 8')
  })
})
