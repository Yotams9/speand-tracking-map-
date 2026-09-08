import { describe, expect, it, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { prepareZXingModule, readBarcodes, ZXING_WASM_SHA256, ZXING_WASM_VERSION } from 'zxing-wasm/reader'
import { readerCandidate } from './barcode-reader-result'
import { validateBarcode, expandUpce } from './barcode-domain'
import { barcodeDemoCatalog, lookupDemoProduct } from './barcode-demo-catalog'
import { barcodePixels } from '../../../qa/fixtures/barcode-symbols'
import { createBarcodeSession, type BarcodeWorker, type DecoderMessage } from './barcode-session'

describe('local barcode identities', () => {
  it('keeps six bilingual synthetic candidates with unique IDs and normalized codes and no purchase facts', () => {
    expect(barcodeDemoCatalog).toHaveLength(6)
    const keys: string[] = []
    for (const p of barcodeDemoCatalog) {
      const result = validateBarcode(p.barcode, p.format)
      expect(result.valid).toBe(true)
      if (!result.valid) throw Error('invalid demo')
      keys.push(result.identity.gtin14)
      expect(lookupDemoProduct(result.identity)).toBe(p)
      expect(p.name.en && p.name.he && p.size.en && p.size.he && p.category.en && p.category.he).toBeTruthy()
      expect(p.provenance).toBe('synthetic-demo-only')
      expect(Object.keys(p).sort()).toEqual(['barcode','category','format','id','name','provenance','size'])
    }
    expect(new Set(keys).size).toBe(6)
    expect(new Set(barcodeDemoCatalog.map((p) => p.id)).size).toBe(6)
  })
  it('preserves leading zero UPC-A and equivalent EAN-13 representation without a duplicate catalog entry', () => {
    const upc = validateBarcode('012345678905','UPCA')
    const ean = validateBarcode('0012345678905','EAN13')
    expect(upc.valid && ean.valid).toBe(true)
    if (!upc.valid || !ean.valid) throw Error('invalid')
    expect(upc.identity.original).toBe('012345678905')
    expect(ean.identity.original).toBe('0012345678905')
    expect(upc.identity.gtin14).toBe(ean.identity.gtin14)
    expect(lookupDemoProduct(upc.identity)).toBe(lookupDemoProduct(ean.identity))
  })
  it('expands all UPC-E compression branches including number system 1', () => {
    expect(expandUpce('01234505')).toBe('012000003455')
    expect(expandUpce('01234535')).toBe('012300000455')
    expect(expandUpce('01234545')).toBe('012340000055')
    expect(expandUpce('01234565')).toBe('012345000065')
    expect(expandUpce('11234562')).toBe('112345000062')
    expect(validateBarcode('11234562','UPCE').valid).toBe(true)
  })
  it('leaves a valid unknown unknown', () => {
    const result = validateBarcode('2999999999991','EAN13')
    expect(result.valid).toBe(true)
    if (result.valid) expect(lookupDemoProduct(result.identity)).toBeUndefined()
  })
  it.each(barcodeDemoCatalog)('rejects a changed checksum for $format $id', (p) => {
    expect(validateBarcode(p.barcode.slice(0,-1) + ((Number(p.barcode.at(-1))+1)%10), p.format)).toEqual({valid:false,reason:'checksum'})
  })
  it.each([['https://example.com','QRCode'], ['123','EAN13'], ['２０００００１１','EAN8'], ['2e000011','EAN8'], ['21234565','UPCE'], [' 20000011','EAN8']])('rejects unsupported or malformed input %s', (code, format) => {
    expect(validateBarcode(code,format).valid).toBe(false)
  })
})

describe('real reader WASM with synthetic pixels', () => {
  beforeAll(async () => {
    const bytes = readFileSync('public/vendor/zxing-wasm/3.1.3/zxing_reader.wasm')
    expect(ZXING_WASM_VERSION).toBe('3.1.3')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(ZXING_WASM_SHA256)
    expect(bytes.equals(readFileSync('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'))).toBe(true)
    await prepareZXingModule({fireImmediately:true,overrides:{wasmBinary:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),locateFile:()=>'/unused-reader.wasm'}})
  })
  it.each(barcodeDemoCatalog)('actually decodes $format $id with the reader-only WASM', async (p) => {
    const result = await readBarcodes(barcodePixels(p.barcode,p.format), {formats:[p.format],maxNumberOfSymbols:1})
    expect(result).toHaveLength(1)
    const candidate = readerCandidate(result[0])
    expect(candidate.invalid).toBe(false)
    expect(candidate.text).toBe(p.barcode)
    const normalized = validateBarcode(candidate.text,candidate.format)
    expect(normalized.valid, JSON.stringify(result.map(({text,format,bytes})=>({text,format,bytes:[...bytes]})))).toBe(true)
    if (normalized.valid) expect(lookupDemoProduct(normalized.identity)?.id).toBe(p.id)
  })
  it('recovers from a damaged real-reader frame to a valid frame in the same session', async () => {
    const damaged=barcodePixels('2000000000015','EAN13')
    // Reproduce the reviewed four-pixel strip defect, without changing encoded digits.
    for(let y=20;y<160;y++)for(let x=59;x<63;x++){
      const i=(y*damaged.width+x)*4
      damaged.data[i]=damaged.data[i+1]=damaged.data[i+2]=255-damaged.data[i]
    }
    const options={formats:['EAN13','EAN8','UPCA','UPCE'] as const,maxNumberOfSymbols:1,tryHarder:false,tryRotate:true,tryInvert:false,returnErrors:true}
    const bad=await readBarcodes(damaged,{...options,formats:[...options.formats]})
    const clean=barcodePixels('2000000000015','EAN13')
    const good=await readBarcodes(clean,{...options,formats:[...options.formats]})
    damaged.data.fill(0); clean.data.fill(0)
    expect(bad).toHaveLength(1); expect(bad[0].isValid).toBe(false)
    expect(good).toHaveLength(1); expect(good[0].isValid).toBe(true)
    const worker:BarcodeWorker={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()}
    const state=vi.fn(),found=vi.fn(),makeWorker=vi.fn(()=>worker)
    const controller=createBarcodeSession({worker:makeWorker,active:()=>true,frame:()=>({data:new Uint8ClampedArray(4),width:1,height:1} as ImageData),release:()=>{},state,found})
    const send=(data:DecoderMessage)=>worker.onmessage?.({data} as MessageEvent<DecoderMessage>)
    vi.useFakeTimers()
    try {
      controller.start(); send({type:'ready'}); vi.advanceTimersByTime(450)
      send({type:'result',results:bad.map(readerCandidate)})
      expect(found).not.toHaveBeenCalled(); expect(worker.terminate).not.toHaveBeenCalled()
      expect(state.mock.calls.map(([value])=>value)).toEqual(['loading','ready'])
      vi.advanceTimersByTime(450); send({type:'result',results:good.map(readerCandidate)})
      expect(found).toHaveBeenCalledOnce(); expect(found).toHaveBeenCalledWith({original:'2000000000015',format:'EAN13',gtin14:'02000000000015'})
      expect(makeWorker).toHaveBeenCalledOnce(); expect(worker.terminate).toHaveBeenCalledOnce()
    } finally {controller.dispose();vi.useRealTimers()}
  })
})


describe('reader representation boundary', () => {
  it('cross-checks original UPC-E metadata against normalized decoder content', () => {
    expect(readerCandidate({text:'0012345000065',format:'UPCE',extra:'{"UPCE":"01234565"}',isValid:true})).toEqual({text:'01234565',format:'UPCE',invalid:false})
    for (const extra of ['{}','null','{"UPCE":1234565}','{"UPCE":"01234564"}','{"UPCE":"11234562"}','malformed']) {
      expect(readerCandidate({text:'0012345000065',format:'UPCE',extra,isValid:true}).invalid).toBe(true)
    }
  })
  it('retains UPC-A leading zeros and rejects upstream invalidity', () => {
    expect(readerCandidate({text:'0012345678905',format:'UPCA',extra:'{}',isValid:true}).text).toBe('012345678905')
    expect(readerCandidate({text:'2000000000015',format:'EAN13',extra:'{}',isValid:false}).invalid).toBe(true)
  })
})
