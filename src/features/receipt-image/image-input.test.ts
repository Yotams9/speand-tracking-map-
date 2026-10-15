import { describe, expect, it, vi } from 'vitest'
import { inspectReceiptImage, MAX_RECEIPT_BYTES, receiptImageHeader } from './image-input'
function png(width=100,height=100){const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,width);v.setUint32(20,height);return b}
describe('bounded receipt image decoding',()=>{
  it('validates MIME and signatures and dimensions before decoding',()=>{
    expect(receiptImageHeader(png(),'image/png')).toEqual({mime:'image/png',width:100,height:100})
    expect(()=>receiptImageHeader(png(),'image/jpeg')).toThrow('image-format');expect(()=>receiptImageHeader(new Uint8Array(),'image/png')).toThrow('image-size')
  })
  it.each([[31,100],[6001,100],[4000,4000]])('rejects oversized decompression %s x %s', (w,h)=>{expect(()=>receiptImageHeader(png(w,h),'image/png')).toThrow('image-size')})
  it('accepts a bounded JPEG SOF and rejects truncated length',()=>{
    const b=Uint8Array.from([255,216,255,192,0,8,8,0,100,0,120,1,255,217]);expect(receiptImageHeader(b,'image/jpeg')).toEqual({mime:'image/jpeg',width:120,height:100});b[5]=100;expect(()=>receiptImageHeader(b,'image/jpeg')).toThrow('image-format')
  })
  it('rejects SVG/HEIC and byte limit without browser decoder access',async()=>{
    const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode)
    try{for(const type of ['image/svg+xml','image/heic'])await expect(inspectReceiptImage(new File(['synthetic'], 'fixture',{type}),new AbortController().signal)).rejects.toThrow('image-format');await expect(inspectReceiptImage(new File([new Uint8Array(MAX_RECEIPT_BYTES+1)],'fixture',{type:'image/png'}),new AbortController().signal)).rejects.toThrow('image-size');expect(decode).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals()}
  })
  it('closes a decoded bitmap after late cancellation',async()=>{
    const controller=new AbortController(),close=vi.fn();vi.stubGlobal('createImageBitmap',async()=>{controller.abort();return{width:100,height:100,close}})
    try{await expect(inspectReceiptImage(new File([png()],'fixture',{type:'image/png'}),controller.signal)).rejects.toThrow('cancelled');expect(close).toHaveBeenCalledTimes(1)}finally{vi.unstubAllGlobals()}
  })
})
