import { describe, expect, it } from 'vitest'
import { fictionalOcr } from './ocr-fixtures'
import { parseOcrReceipt, validateOcrDocument, type OcrDocument, type OcrWord } from './ocr-parser'
import { receiptToReviewDraft, prepareReceiptReview } from '../capture/receipt-review-adapter'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { emptySessionLedger, saveReviewedPurchase, undoSessionPurchase } from '../capture/session-purchase-domain'
import {layoutReason} from './layout-reason'

describe('provider-neutral labelled receipt geometry', () => {
  it.each(['Qty','Unit','Price'])('keeps known fields when printed %s header cannot be resolved',async key=>{
    const doc=fictionalOcr('one');doc.words.find(w=>w.text===key)!.text='Unknown'
    const line=parseOcrReceipt(doc).observations.lines[0]
    expect(line.name).toBe('קוואקר בדוי Oats');expect(line.lineAmount).toBe('12.50')
    expect(line[key==='Qty'?'quantity':key==='Unit'?'unit':'unitPrice']).toBeNull()
    expect(line.discount).toBeNull() // An unknown column cannot be assumed not to contain a discount.
    expect((await completeReview(doc)).ready.ready).toBe(false)
  })
  it('joins a bounded name-only continuation without inventing an item',()=>{
    const doc=fictionalOcr('one');doc.words.push({text:'Extended',x:30,y:277,width:70,height:20})
    const lines=parseOcrReceipt(doc).observations.lines
    expect(lines).toHaveLength(1);expect(lines[0]).toMatchObject({name:'קוואקר בדוי Oats Extended',quantity:'2',unitPrice:'6.25',lineAmount:'12.50'})
  })
  it('accepts modest vertical baseline variation without changing values',()=>{
    const doc=fictionalOcr('one');doc.words=doc.words.map(w=>({...w,y:w.y+(w.x>450?12:0)}))
    expect(parseOcrReceipt(doc).observations.lines[0]).toMatchObject({quantity:'2',unitPrice:'6.25',lineAmount:'12.50'})
  })
  it('rejects competing known columns with a fixed structural reason',()=>{
    const doc=fictionalOcr('one');doc.words.push({text:'Qty',x:700,y:210,width:30,height:20})
    let error:unknown;try{parseOcrReceipt(doc)}catch(e){error=e}
    expect(layoutReason(error)).toBe('column-header-ambiguous')
  })
  it('keeps a deterministic 15-item duplicate fingerprint and consumed IDs through Undo', async () => {
    const context = await fixtureSpendscapeRepository.loadSnapshot()
    const prepare = () => {
      const draft = receiptToReviewDraft(parseOcrReceipt(fictionalOcr('fifteen')).observations)
      Object.assign(draft.review, { channel: 'physical', placeId: 'place_shuk_bograshov', merchantId: 'merchant_shuk', date: '2026-10-03T06:15', payment: 'cash', category: 'groceries' })
      const ready = prepareReceiptReview(draft, context)
      if (!ready.ready) throw new Error('synthetic-review-not-ready')
      return ready.input
    }
    const first = saveReviewedPurchase(emptySessionLedger(), 'first', prepare(), context, context.purchases)
    expect(first.result.code).toBe('saved')
    expect(first.ledger.records[0].purchase.items).toHaveLength(15)
    expect(saveReviewedPurchase(first.ledger, 'second', prepare(), context, context.purchases).result.code).toBe('duplicate')
    const undone = undoSessionPurchase(first.ledger)
    expect(undone.records).toHaveLength(0)
    expect(saveReviewedPurchase(undone, 'first', prepare(), context, context.purchases).result.code).toBe('consumed')
    const readded = saveReviewedPurchase(undone, 'third', prepare(), context, context.purchases)
    expect(readded.result.code).toBe('saved')
    expect(saveReviewedPurchase(readded.ledger, 'fourth', prepare(), context, context.purchases).result.code).toBe('duplicate')
  })
  it.each(['one', 'fifteen'] as const)('preserves %s receipt facts through explicit review without VAT or barcode', async fixture => {
    const o = parseOcrReceipt(fictionalOcr(fixture)).observations
    expect(o.lines).toHaveLength(fixture === 'one' ? 1 : 15)
    expect(o).toMatchObject({ date: '2026-10-03', time: '09:15', currency: 'ILS', finalAmount: fixture === 'one' ? '12.50' : '41.00' })
    expect(o).not.toHaveProperty('vatAmount'); expect(o.lines.every(l => !('barcode' in l))).toBe(true)
    if (fixture === 'fifteen') expect(o.lines.slice(0, 2)).toEqual([{ name: 'לחם בדוי Bread', quantity: '2', unit: 'יח׳', unitPrice: '3.25', discount: '0.50', lineAmount: '6.00' }, { name: 'תפוחים בדויים Apples', quantity: '0.375', unit: 'ק״ג', unitPrice: '24.00', discount: '0.00', lineAmount: '9.00' }])
    const draft = receiptToReviewDraft(o), context = await fixtureSpendscapeRepository.loadSnapshot()
    expect(prepareReceiptReview(draft, context).ready).toBe(false)
    Object.assign(draft.review, { channel: 'physical', placeId: 'place_shuk_bograshov', merchantId: 'merchant_shuk', date: '2026-10-03T06:15', payment: 'cash', category: 'groceries' })
    expect(prepareReceiptReview(draft, context).ready).toBe(true)
    expect(draft.observations).toEqual(o)
  })
  it('does not choose headers using an expected answer', () => {
    const doc = fictionalOcr('one');doc.words.find(w => w.text === '12.50' && w.y === 310)!.text = '999.99'
    doc.words.push({text:'Total:',x:30,y:355,width:100,height:20},{text:'7.11',x:160,y:355,width:40,height:20})
    expect(parseOcrReceipt(doc).observations.finalAmount).toEqual({ candidates: ['999.99','7.11'] })
  })
  it('reconstructs adjacent decimal fragments verbatim', () => {
    const doc = fictionalOcr('one'), w = doc.words.find(w => w.text === '6.25')!, i = doc.words.indexOf(w)
    doc.words.splice(i,1,{...w,text:'6',width:8},{...w,text:'.',x:w.x+9,width:4},{...w,text:'25',x:w.x+14,width:16})
    expect(parseOcrReceipt(doc).observations.lines[0].unitPrice).toBe('6.25')
  })
  it('reconstructs split dates without replacing characters', () => {
    const doc = fictionalOcr('one'), w = doc.words.find(w => w.text === '2026-10-03')!, i = doc.words.indexOf(w)
    doc.words.splice(i,1,{...w,text:'2026-',width:40},{...w,text:'10-03',x:w.x+42,width:40})
    expect(parseOcrReceipt(doc).observations.date).toBe('2026-10-03')
  })
  it('leaves separated neighboring numbers and overlapping candidates unresolved', () => {
    for (const delta of [0,70]) {
      const doc = fictionalOcr('one'), w = doc.words.find(w => w.text === '6.25')!
      doc.words.push({...w,text:'98765',x:w.x+delta,width:35})
      expect(parseOcrReceipt(doc).observations.lines[0].unitPrice).toBeNull()
    }
  })
  it('preserves malformed facts without O-to-zero repair or invented unit/discount', () => {
    const doc = fictionalOcr('one');doc.words.find(w => w.text === '6.25')!.text = 'O.25';doc.words.find(w => w.text === 'item')!.text = 'unknown'
    const line = parseOcrReceipt(doc).observations.lines[0]
    expect(line.unitPrice).toBe('O.25');expect(line.unit).toBe('unknown');expect(line).not.toHaveProperty('discount')
  })
  it('keeps printed mismatch and missing time unresolved through preparation', async () => {
    const doc = fictionalOcr('one');doc.words = doc.words.filter(w => !['Time:','09:15'].includes(w.text));doc.words.find(w => w.text === '12.50')!.text = '12.49'
    const o = parseOcrReceipt(doc).observations;expect(o.time).toBeNull();expect(o.lines[0].lineAmount).toBe('12.49')
    const draft = receiptToReviewDraft(o);Object.assign(draft.review,{channel:'unknown',merchantId:'merchant_unresolved',date:'2026-10-03T06:15',payment:'cash',category:'groceries'})
    expect(prepareReceiptReview(draft,await fixtureSpendscapeRepository.loadSnapshot())).toMatchObject({ready:false,errors:{'printedAmount-0':'arithmetic'}})
  })
  it('never converts an internal item/receipt identifier into a barcode', () => {
    const doc = fictionalOcr('one');doc.words.find(w => w.text === 'קוואקר בדוי Oats')!.text = '189274';doc.words.push({text:'Receipt-ID:',x:30,y:355,width:100,height:20},{text:'4006381333931',x:160,y:355,width:104,height:20})
    const o = parseOcrReceipt(doc).observations;expect(o.lines[0].name).toBe('189274');expect(o.lines[0]).not.toHaveProperty('barcode')
  })
  it('keeps missing final amount unresolved without deriving it from line arithmetic', () => {
    const doc=fictionalOcr('one');doc.words=doc.words.filter(w=>w.y!==310);const o=parseOcrReceipt(doc).observations
    expect(o.finalAmount).toBeNull();expect(o.lines).toHaveLength(1)
  })
  it('rejects two adjacent complete quantity integers rather than concatenating them', () => {
    const doc=fictionalOcr('one'),w=doc.words.find(w=>w.text==='2')!;doc.words.push({...w,text:'3',x:w.x+w.width+3})
    expect(parseOcrReceipt(doc).observations.lines[0].quantity).toBeNull()
  })
  it('rejects unsupported or competing tables and oversized runtime documents', () => {
    const doc = fictionalOcr('one');doc.words.find(w => w.text === 'Qty')!.text='Unknown';expect(parseOcrReceipt(doc).observations.lines[0]).toMatchObject({quantity:null,unitPrice:'6.25',lineAmount:'12.50',discount:null})
    const repeated = fictionalOcr('one');repeated.words.push(...repeated.words.filter(w=>w.y===210).map(w=>({...w,y:370})));expect(()=>parseOcrReceipt(repeated)).toThrow('layout-unsupported')
    expect(validateOcrDocument({...fictionalOcr('one'),words:Array(1501).fill(fictionalOcr('one').words[0])})).toBe(false)
  })
  it('rejects sparse, accessor, hidden, extra-property and out-of-bounds geometry without reading accessors', () => {
    const raw=fictionalOcr('one');expect(validateOcrDocument({...raw,words:new Array(2)})).toBe(false)
    const a=fictionalOcr('one');Object.defineProperty(a.words,'0',{get(){throw new Error('secret')}});expect(validateOcrDocument(a)).toBe(false)
    const b=fictionalOcr('one');Object.defineProperty(b.words,'extra',{value:'secret'});expect(validateOcrDocument(b)).toBe(false)
    const c=fictionalOcr('one');c.words[0].x=-1;expect(validateOcrDocument(c)).toBe(false)
  })
})

const boxed = (text: string, x: number, y: number, width = 32): OcrWord => ({ text, x, y, width, height: 20 })
function replaceWords(doc: OcrDocument, text: string, words: OcrWord[]) {
  const original = doc.words.find(w => w.text === text)!
  doc.words.splice(doc.words.indexOf(original), 1, ...words)
}
async function completeReview(doc: OcrDocument) {
  const draft = receiptToReviewDraft(parseOcrReceipt(doc).observations)
  Object.assign(draft.review, { channel: 'unknown', merchantId: 'merchant_unresolved', date: '2026-10-03T06:15', payment: 'cash', category: 'groceries' })
  return { draft, ready: prepareReceiptReview(draft, await fixtureSpendscapeRepository.loadSnapshot()) }
}

describe('review correction: bilingual word runs and competing header occurrences', () => {
  for (const fixture of ['one', 'fifteen'] as const) {
    const original = fixture === 'one' ? 'קוואקר בדוי Oats' : 'לחם בדוי Bread'
    const left = fixture === 'one' ? 10 : 610
    it.each([
      { words: ['בדוי', 'לחם'], expected: 'לחם בדוי' },
      { words: ['Brown', 'Bread'], expected: 'Brown Bread' },
      { words: ['Brown', 'Bread', 'בדוי', 'לחם'], expected: 'לחם בדוי Brown Bread' },
    ])(`orders separate content runs under ${fixture} table headers: $expected`, ({ words, expected }) => {
      const doc = fictionalOcr(fixture)
      replaceWords(doc, original, words.map((text, i) => boxed(text, left + i * 45, 250)))
      const before = structuredClone(doc)
      const observations = parseOcrReceipt(doc).observations
      expect(observations.lines[0].name).toBe(expected)
      const draft = receiptToReviewDraft(observations)
      draft.review.lines[0].name = 'Explicit user correction'
      expect(draft.observations.lines[0].name).toBe(expected)
      expect(doc).toEqual(before)
    })
    it(`preserves merchant/address Hebrew and Latin runs under ${fixture} header keys`, () => {
      const doc = fictionalOcr(fixture)
      replaceWords(doc, 'Fictional Demo Market', [boxed('בדוי', 180, 20), boxed('בית', 240, 20)])
      replaceWords(doc, 'Imaginary Street 12', [boxed('Imaginary', 180, 55, 72), boxed('Street', 265, 55, 48), boxed('12', 325, 55)])
      expect(parseOcrReceipt(doc).observations).toMatchObject({ merchantName: 'בית בדוי', address: 'Imaginary Street 12' })
    })
  }
  it('leaves overlapping label boxes unresolved instead of choosing an order', async () => {
    const doc = fictionalOcr('one')
    replaceWords(doc, 'קוואקר בדוי Oats', [boxed('לחם', 70, 250, 40), boxed('בדוי', 90, 250, 40)])
    expect(parseOcrReceipt(doc).observations.lines[0].name).toBeNull()
    const { ready } = await completeReview(doc)
    expect(ready.ready).toBe(false)
  })
  for (const field of ['finalAmount', 'date'] as const) {
    for (const first of [false, true]) {
      it(`retains ambiguous ${field} with a resolved repeat; ambiguous first=${first}`, async () => {
        const doc = fictionalOcr('one'), key = field === 'date' ? 'Date:' : 'Total:'
        const y = first ? (field === 'date' ? 5 : 285) : 355
        const fragments = field === 'date' ? ['2026-10-03', '2026-10-04'] : ['9.99', '99.99']
        doc.words.push(boxed(key, 30, y, 100), boxed(fragments[0], 160, y, 80), boxed(fragments[1], 300, y, 80))
        const result = parseOcrReceipt(doc)
        expect(result.observations[field]).toBeNull()
        expect(result.diagnostics.unresolved).toBeGreaterThan(0)
        const { draft, ready } = await completeReview(doc)
        if (field === 'finalAmount') { expect(draft.review.amount).toBe(''); expect(ready.ready).toBe(false) }
        else expect(draft.observations.date).toBeNull() // Explicit manual date confirmation is a legitimate correction.
      })
    }
  }
  it.each(['Total:', 'Date:'])('retains an empty printed %s occurrence alongside a resolved repeat', key => {
    const doc = fictionalOcr('one'); doc.words.push(boxed(key, 30, 355, 100))
    expect(parseOcrReceipt(doc).observations[key === 'Date:' ? 'date' : 'finalAmount']).toBeNull()
  })
  it('retains identical resolved repeats and distinguishes conflicting resolved totals', () => {
    const doc = fictionalOcr('one'); doc.words.push(boxed('Total:', 30, 355, 100), boxed('12.50', 160, 355, 40))
    expect(parseOcrReceipt(doc).observations.finalAmount).toBe('12.50')
    doc.words.find(w => w.y === 355 && w.text === '12.50')!.text = '12.49'
    expect(parseOcrReceipt(doc).observations.finalAmount).toEqual({ candidates: ['12.50', '12.49'] })
  })
  it('keeps optional tax ambiguity unresolved without blocking core preparation', async () => {
    const doc = fictionalOcr('one')
    doc.words.push(boxed('VAT:', 30, 355, 100), boxed('2.00', 160, 355, 32), boxed('VAT:', 30, 390, 100), boxed('1.00', 160, 390, 32), boxed('9.99', 300, 390, 40))
    expect(parseOcrReceipt(doc).observations.vatAmount).toBeNull()
    expect((await completeReview(doc)).ready.ready).toBe(true)
  })
  it('never repairs an observed malformed singleton to match another total', () => {
    const doc = fictionalOcr('one'); doc.words.push(boxed('Total:', 30, 355, 100), boxed('O.50', 160, 355, 40))
    expect(parseOcrReceipt(doc).observations.finalAmount).toEqual({ candidates: ['12.50', 'O.50'] })
  })
})

describe('unassigned labelled-table rows cannot create items',()=>{
  it.each(['unknown','numeric'])('rejects isolated %s cell without a product anchor',kind=>{
    const doc=fictionalOcr('one');doc.words.find(w=>w.text==='Unit')!.text='Unknown';
    doc.words.push({text:kind==='unknown'?'Unassigned':'99',x:kind==='unknown'?480:760,y:285,width:60,height:20});
    let error:unknown;try{parseOcrReceipt(doc)}catch(e){error=e};expect(layoutReason(error)).toBe('item-row-unassigned')
  })
})
