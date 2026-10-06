import {describe,it,expect} from 'vitest'
import {parseVisionReceipt} from './short-receipt-parser'
import {fictionalShortOcr} from './vision-fixtures'
import {fictionalOcr} from './ocr-fixtures'
import {receiptToReviewDraft,prepareReceiptReview} from '../capture/receipt-review-adapter'
import {fixtureSpendscapeRepository} from '../../data/spendscape-repository'
import {layoutReason} from './layout-reason'
import {safeAttemptEvent} from './vision-attempt'
import {vi,afterEach,beforeEach} from 'vitest'
beforeEach(()=>vi.stubGlobal('fetch',()=>{throw new Error('OFFLINE_NETWORK_GUARD')}))
afterEach(()=>vi.unstubAllGlobals())
describe('relative short printed receipt layout',()=>{
  it.each([1,15])('preserves %s lines and unresolved facts without IDs, currency or units',async count=>{const doc=fictionalShortOcr(count),before=structuredClone(doc),r=parseVisionReceipt(doc);expect(r.observations).toMatchObject({merchantName:'בית בדוי',address:'Imaginary Street 8',date:'04-10-26',time:'10:35',currency:null,finalAmount:(count*7.5).toFixed(2)});expect(r.observations.lines).toHaveLength(count);expect(r.observations.lines[0]).toEqual({name:'מוצר בדוי',quantity:'3',unit:null,unitPrice:'2.50',lineAmount:'7.50'});expect(doc).toEqual(before);const draft=receiptToReviewDraft(r.observations);expect(prepareReceiptReview(draft,await fixtureSpendscapeRepository.loadSnapshot()).ready).toBe(false)})
  it('preserves existing explicit table discounts and fully discounted lines',()=>{const doc=fictionalOcr('fifteen');expect(parseVisionReceipt(doc).observations).toEqual(parseVisionReceipt(structuredClone(doc)).observations);expect(parseVisionReceipt(doc).observations.lines[0].discount).toBe('0.50')})
  it('uses translated/scaled geometry with no reference answer',()=>{const doc=fictionalShortOcr();doc.width=2000;doc.height=2000;doc.words=doc.words.map(w=>({...w,x:w.x*1.5+100,y:w.y*1.5+50,width:w.width*1.5,height:w.height*1.5}));const item=doc.words.find(w=>w.text==='7.50')!;item.text='7.49';expect(parseVisionReceipt(doc).observations.lines[0].lineAmount).toBe('7.49')})
  it('leaves competing totals as candidates rather than repairing',()=>{const doc=fictionalShortOcr();const total=doc.words.filter(w=>w.y===425);doc.words.push(...total.map(w=>({...w,y:465,text:w.text==='7.50'?'7.49':w.text})));expect(parseVisionReceipt(doc).observations.finalAmount).toEqual({candidates:['7.50','7.49']})})
  it('rejects neighboring number ambiguity, preserves malformed singleton',()=>{const doc=fictionalShortOcr(),w=doc.words.find(w=>w.text==='2.50')!;doc.words.push({...w,x:620,text:'99'});expect(parseVisionReceipt(doc).observations.lines[0].unitPrice).toBeNull()})
  it('does not infer optional VAT, discount, units, currency or barcode',()=>{const r=parseVisionReceipt(fictionalShortOcr());expect(r.observations.lines[0]).not.toHaveProperty('barcode');expect(r.observations.lines[0]).not.toHaveProperty('discount');expect(r.observations).not.toHaveProperty('vatAmount');expect(r.observations.currency).toBeNull()})
  it('preserves partial lines with absent numeric fields but rejects competing table headers',()=>{
    for(const kind of ['header','row']){const doc=fictionalShortOcr();if(kind==='header')doc.words=doc.words.filter(w=>w.text!=='כמות');else doc.words=doc.words.filter(w=>w.y!==288);const line=parseVisionReceipt(doc).observations.lines[0];expect(line).toMatchObject({name:'מוצר בדוי',lineAmount:'7.50',quantity:null,unitPrice:null})}
    const repeated=fictionalShortOcr();repeated.words.push(...repeated.words.filter(w=>w.y===180).map(w=>({...w,y:700})));expect(()=>parseVisionReceipt(repeated)).toThrow('layout-unsupported')
  })
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

describe('bounded short-layout variations and structural reasons',()=>{
  it.each([5,10,12])('handles modest header/item baseline misalignment of %s pixels',delta=>{
    const doc=fictionalShortOcr(2)
    doc.words=doc.words.map(w=>({...w,y:w.y+(w.x>800?delta:0)}))
    expect(parseVisionReceipt(doc).observations.lines).toHaveLength(2)
    expect(parseVisionReceipt(doc).observations.lines[1]).toMatchObject({quantity:'3',unitPrice:'2.50',lineAmount:'7.50'})
  })
  it('recognizes split header words with punctuation without using expected item values',()=>{
    const doc=fictionalShortOcr(),word=doc.words.find(w=>w.text==='יחידה')!
    doc.words.splice(doc.words.indexOf(word),1,{...word,text:'דה',width:14},{...word,text:'יחי',x:541,width:24})
    doc.words.find(w=>w.text==='2.50')!.text='2.47'
    expect(parseVisionReceipt(doc).observations.lines[0].unitPrice).toBe('2.47')
  })
  it.each([1,3,15])('uses printed item starts for %s wrapped descriptions and variable spacing',count=>{
    const doc=fictionalShortOcr(count)
    const summaryY=290+count*65
    doc.height=6000
    doc.words=doc.words.map(w=>{
      if(w.y>=summaryY)return {...w,y:w.y+count*80}
      if(w.y<260)return w
      const index=Math.floor((w.y-260)/65),isNumeric=(w.y-260)%65===28
      return {...w,y:260+index*130+(isNumeric?70:0)}
    })
    for(let i=0;i<count;i++)doc.words.push({text:'Extended',x:500,y:290+i*130,width:70,height:20})
    const result=parseVisionReceipt(doc)
    expect(result.observations.lines).toHaveLength(count)
    for(const line of result.observations.lines)expect(line).toMatchObject({name:'מוצר בדוי Extended',quantity:'3',unitPrice:'2.50',lineAmount:'7.50'})
  })
  it('keeps absent payable total unresolved while preserving observed items',()=>{
    const doc=fictionalShortOcr();doc.words=doc.words.filter(w=>w.y<355)
    expect(parseVisionReceipt(doc).observations).toMatchObject({finalAmount:null,lines:[{lineAmount:'7.50',quantity:'3'}]})
  })
  it('does not pair a distant numeric row or two competing numeric rows',()=>{
    for(const kind of ['distant','competing']){
      const doc=fictionalShortOcr();doc.height=2000
      if(kind==='distant')doc.words=doc.words.map(w=>({...w,y:w.y===288?500:w.y>=355?w.y+600:w.y}))
      else doc.words.push(...doc.words.filter(w=>w.y===288).map(w=>({...w,y:318,text:w.text==='3'?'4':w.text})))
      const line=parseVisionReceipt(doc).observations.lines[0]
      expect(line.quantity).toBeNull();expect(line.unitPrice).toBeNull();expect(line.lineAmount).toBe('7.50')
    }
  })
  it('preserves two incomplete anchored items without shifting the next quantity into the first',()=>{
    const doc=fictionalShortOcr(2);doc.words=doc.words.filter(w=>w.y!==288)
    const lines=parseVisionReceipt(doc).observations.lines
    expect(lines[0].quantity).toBeNull();expect(lines[1].quantity).toBe('3');expect(lines).toHaveLength(2)
  })
  it('preserves observed malformed numbers and arithmetic discrepancies through review',async()=>{
    const doc=fictionalShortOcr();doc.words.find(w=>w.text==='2.50')!.text='O.50';doc.words.find(w=>w.y===260&&w.text==='7.50')!.text='7.49'
    const observations=parseVisionReceipt(doc).observations
    expect(observations.lines[0]).toMatchObject({unitPrice:'O.50',lineAmount:'7.49'})
    expect(prepareReceiptReview(receiptToReviewDraft(observations),await fixtureSpendscapeRepository.loadSnapshot()).ready).toBe(false)
  })
  it.each(['missing','ambiguous','order','unassigned','no-items'])('emits fixed structural reason for %s',kind=>{
    const doc=fictionalShortOcr()
    const expected={missing:'table-header-missing',ambiguous:'table-header-ambiguous',order:'column-order-unsupported',unassigned:'item-row-unassigned','no-items':'item-anchor-missing'}[kind]
    if(kind==='missing')doc.words=doc.words.filter(w=>w.text!=='תיאור')
    if(kind==='ambiguous')doc.words.push(...doc.words.filter(w=>w.y===180).map(w=>({...w,y:700})))
    if(kind==='order')doc.words.find(w=>w.y===180&&w.text==='סה״כ')!.x=750
    if(kind==='unassigned')doc.words.push({text:'Unbound',x:10,y:245,width:50,height:20})
    if(kind==='no-items')doc.words=doc.words.filter(w=>w.y!==260&&w.y!==288)
    let caught:unknown;try{parseVisionReceipt(doc)}catch(e){caught=e}
    expect(layoutReason(caught)).toBe(expected)
    expect(safeAttemptEvent('failure',1,{code:'layout-unsupported',layoutReason:layoutReason(caught),message:'SYNTHETIC_SECRET'})).toEqual({stage:'failure',elapsedMs:1,code:'layout-unsupported',layoutReason:expected})
  })
  it('never accepts arbitrary diagnostic content or a reason on unrelated failure',()=>{
    expect(safeAttemptEvent('failure',1,{code:'layout-unsupported',layoutReason:'SYNTHETIC_SECRET'})).not.toHaveProperty('layoutReason')
    expect(safeAttemptEvent('failure',1,{code:'authentication-failed',layoutReason:'table-header-missing'})).not.toHaveProperty('layoutReason')
  })
  it('leaves repeated numeric header anchors unresolved rather than choosing one',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'Quantity',x:740,y:215,width:70,height:20})
    expect(parseVisionReceipt(doc).observations.lines[0]).toMatchObject({quantity:null,unitPrice:null,lineAmount:'7.50'})
  })
  it('keeps boundary-crossing line amounts unresolved without dropping competing evidence',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'99',x:290,y:260,width:40,height:20})
    expect(parseVisionReceipt(doc).observations.lines[0].lineAmount).toBeNull()
  })
  it('keeps overlapping or too distant description continuations unresolved/rejected',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'Extra',x:510,y:260,width:40,height:20})
    expect(parseVisionReceipt(doc).observations.lines[0].name).toBeNull()
    const distant=fictionalShortOcr();distant.words.push({text:'Detached',x:500,y:340,width:70,height:5})
    // An independently printed description cannot become a new item without anchors.
    const result=parseVisionReceipt(distant).observations.lines
    expect(result).toHaveLength(1)
  })
  it('rejects an unassigned amount/discount row instead of inventing a product or discount',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'-1.00',x:60,y:320,width:50,height:20})
    let error:unknown;try{parseVisionReceipt(doc)}catch(e){error=e}
    expect(layoutReason(error)).toBe('item-row-unassigned')
  })
  it('preserves missing printed line amount rather than calculating it',()=>{
    const doc=fictionalShortOcr();doc.words=doc.words.filter(w=>!(w.y===260&&w.x===60))
    expect(parseVisionReceipt(doc).observations.lines[0]).toMatchObject({lineAmount:null,quantity:'3',unitPrice:'2.50'})
  })
  it('missing numeric header and row never borrows values from total or identifiers',()=>{
    const doc=fictionalShortOcr();doc.words=doc.words.filter(w=>w.y!==215&&w.y!==288)
    const line=parseVisionReceipt(doc).observations.lines[0]
    expect(line).toMatchObject({quantity:null,unitPrice:null,unit:null,lineAmount:'7.50'})
    expect(line).not.toHaveProperty('barcode');expect(line).not.toHaveProperty('discount')
  })
})

 describe('reviewed item-anchor and discount evidence corrections',()=>{
  it.each(['I.50','S.50','o.50'])('retains damaged price %s without creating another product',async text=>{
    const doc=fictionalShortOcr();doc.words.find(w=>w.text==='2.50')!.text=text;
    const result=parseVisionReceipt(doc).observations;
    expect(result.lines).toHaveLength(1);expect(result.lines[0]).toMatchObject({name:'מוצר בדוי',quantity:'3',unitPrice:text,lineAmount:'7.50'});
    expect(prepareReceiptReview(receiptToReviewDraft(result),await fixtureSpendscapeRepository.loadSnapshot()).ready).toBe(false)
  })
  it('does not append a damaged singleton price to the product label',()=>{
    const doc=fictionalShortOcr();doc.words=doc.words.filter(w=>!(w.y===288&&w.text==='3'));doc.words.find(w=>w.text==='2.50')!.text='I.50';
    expect(parseVisionReceipt(doc).observations.lines).toMatchObject([{name:'מוצר בדוי',unitPrice:'I.50',quantity:null}])
  })
  it('preserves split decimal fragments in numeric rows',()=>{
    const doc=fictionalShortOcr(),word=doc.words.find(w=>w.text==='2.50')!;word.text='2.';word.width=16;doc.words.push({...word,text:'50',x:558,width:16});
    expect(parseVisionReceipt(doc).observations.lines[0].unitPrice).toBe('2.50')
  })
  it('retains an unresolved percentage when numeric rows compete',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'10%',x:540,y:320,width:30,height:20});
    const result=parseVisionReceipt(doc).observations.lines;
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({quantity:null,unitPrice:null,discount:null,lineAmount:'7.50'})
  })
  it('keeps a single numeric-row percentage unresolved and does not infer an amount',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'10%',x:625,y:288,width:30,height:20});
    expect(parseVisionReceipt(doc).observations.lines[0]).toHaveProperty('discount',null)
  })
  it('rejects an unrelated text row beside a short number without inventing an item',()=>{
    const doc=fictionalShortOcr();doc.words.push({text:'Unassigned',x:540,y:320,width:70,height:20},{text:'3',x:875,y:320,width:20,height:20});
    let error:unknown;try{parseVisionReceipt(doc)}catch(e){error=e};expect(layoutReason(error)).toBe('item-row-unassigned')
  })
})
