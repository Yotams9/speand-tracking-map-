import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBarcodeSession, type BarcodeWorker, type DecoderMessage } from './barcode-session'

function setup() {
  const workers: BarcodeWorker[] = []
  const state = vi.fn(), found = vi.fn(), release = vi.fn()
  let active = true
  const frame = vi.fn(() => ({data:new Uint8ClampedArray(4),width:1,height:1} as ImageData))
  const worker = vi.fn(() => {
    const value: BarcodeWorker = {onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()}
    workers.push(value); return value
  })
  const controller = createBarcodeSession({worker,frame,active:()=>active,release,state,found})
  const send = (data: DecoderMessage) => workers.at(-1)!.onmessage?.({data} as MessageEvent<DecoderMessage>)
  return {controller,workers,state,found,frame,worker,release,send,hide:()=>{active=false}}
}
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>vi.useRealTimers())
describe('barcode worker lifecycle', () => {
  it('loads lazily and allows only one in-flight operation, throttled after completion', () => {
    const s=setup(); expect(s.worker).not.toHaveBeenCalled()
    s.controller.start(); s.send({type:'ready'}); s.send({type:'ready'})
    vi.advanceTimersByTime(450); expect(s.frame).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000); expect(s.frame).toHaveBeenCalledTimes(1)
    s.send({type:'result',results:[]}); vi.advanceTimersByTime(449); expect(s.frame).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1); expect(s.frame).toHaveBeenCalledTimes(2)
    s.controller.dispose(); expect(s.workers[0].terminate).toHaveBeenCalledOnce()
  })
  it('accepts one candidate and ignores repeated or late frames even across restart', () => {
    const s=setup(); s.controller.start(); s.send({type:'ready'}); vi.advanceTimersByTime(450)
    const callback=s.workers[0].onmessage!
    const event={data:{type:'result',results:[{text:'2000000000015',format:'EAN13',invalid:false}]}} as MessageEvent<DecoderMessage>
    callback(event); callback(event)
    expect(s.found).toHaveBeenCalledTimes(1); expect(s.workers[0].terminate).toHaveBeenCalledOnce()
    s.controller.start(); callback(event); expect(s.found).toHaveBeenCalledTimes(1)
    s.controller.dispose()
  })
  it.each(['cancel','dispose','hidden'] as const)('invalidates pending decode on %s', (action) => {
    const s=setup(); s.controller.start(); s.send({type:'ready'}); vi.advanceTimersByTime(450)
    const callback=s.workers[0].onmessage!
    if(action==='hidden')s.hide(); else s.controller[action]()
    callback({data:{type:'result',results:[{text:'2000000000015',format:'EAN13',invalid:false}]}} as MessageEvent<DecoderMessage>)
    expect(s.found).not.toHaveBeenCalled(); expect(s.workers[0].terminate).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(30_000); expect(s.frame).toHaveBeenCalledTimes(1)
  })
  it('cannot revive a cancelled initialization', () => {
    const s=setup(); s.controller.start(); const callback=s.workers[0].onmessage!
    s.controller.cancel(); callback({data:{type:'ready'}} as MessageEvent<DecoderMessage>)
    vi.advanceTimersByTime(20_000); expect(s.frame).not.toHaveBeenCalled()
    expect(s.state).toHaveBeenLastCalledWith('cancelled')
  })
  it.each(['load-error','decode-error'] as const)('terminates on %s and waits for explicit retry', (type) => {
    const s=setup(); s.controller.start(); s.send({type})
    vi.advanceTimersByTime(30_000); expect(s.worker).toHaveBeenCalledTimes(1)
    expect(s.state).toHaveBeenLastCalledWith(type); expect(s.workers[0].terminate).toHaveBeenCalledOnce()
    s.controller.start(); expect(s.worker).toHaveBeenCalledTimes(2); s.controller.dispose()
  })
  it('bounds initialization, decode and no-result waiting', () => {
    const s=setup(); s.controller.start(); vi.advanceTimersByTime(12_000)
    expect(s.state).toHaveBeenLastCalledWith('load-error')
    s.controller.start(); s.send({type:'ready'}); vi.advanceTimersByTime(5450)
    expect(s.state).toHaveBeenLastCalledWith('decode-error')
    s.controller.start(); s.send({type:'ready'})
    for(let i=0;i<20;i++){ vi.advanceTimersByTime(450); s.send({type:'result',results:[]}) }
    vi.advanceTimersByTime(450); expect(s.state).toHaveBeenLastCalledWith('empty')
  })
  it.each([{text:'2000000000014',format:'EAN13',invalid:false},{text:'https://example.com',format:'QRCode',invalid:false},{text:'2000000000015',format:'EAN13',invalid:true}])('rejects invalid checksum or unsupported decoder output', (result) => {
    const s=setup(); s.controller.start(); s.send({type:'ready'}); vi.advanceTimersByTime(450); s.send({type:'result',results:[result]})
    expect(s.found).not.toHaveBeenCalled(); expect(s.state).toHaveBeenLastCalledWith('ready')
    expect(s.workers[0].terminate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(450); expect(s.frame).toHaveBeenCalledTimes(2)
    s.controller.dispose()
  })
  it('bounds repeated invalid camera samples without announcing each failure', () => {
    const s=setup(); s.controller.start(); s.send({type:'ready'})
    for(let i=0;i<20;i++){
      vi.advanceTimersByTime(450)
      s.send({type:'result',results:[{text:'2000000000014',format:'EAN13',invalid:true}]})
      expect(s.state.mock.calls.map(([state])=>state)).toEqual(['loading','ready'])
      expect(s.found).not.toHaveBeenCalled()
    }
    vi.advanceTimersByTime(450)
    expect(s.state).toHaveBeenLastCalledWith('empty')
    expect(s.frame).toHaveBeenCalledTimes(20)
    expect(s.worker).toHaveBeenCalledOnce(); expect(s.workers[0].terminate).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60_000); expect(s.frame).toHaveBeenCalledTimes(20)
  })
  it('rejects late valid results and scheduled work after cancelling an invalid sample', () => {
    const s=setup(); s.controller.start(); s.send({type:'ready'}); vi.advanceTimersByTime(450)
    s.send({type:'result',results:[{text:'2000000000014',format:'EAN13',invalid:true}]})
    const callback=s.workers[0].onmessage!
    s.controller.cancel()
    callback({data:{type:'result',results:[{text:'2000000000015',format:'EAN13',invalid:false}]}} as MessageEvent<DecoderMessage>)
    vi.advanceTimersByTime(60_000)
    expect(s.found).not.toHaveBeenCalled(); expect(s.frame).toHaveBeenCalledOnce()
    expect(s.workers[0].terminate).toHaveBeenCalledOnce(); expect(s.state).toHaveBeenLastCalledWith('cancelled')
  })
  it('handles Worker construction and postMessage failures without leaking pixels', () => {
    const s=setup(); s.worker.mockImplementationOnce(()=>{throw Error('worker')}); s.controller.start()
    expect(s.state).toHaveBeenLastCalledWith('load-error')
    s.controller.start(); s.send({type:'ready'})
    const pixels=new Uint8ClampedArray(4).fill(255)
    s.frame.mockReturnValue({data:pixels,width:1,height:1} as ImageData)
    vi.mocked(s.workers[0].postMessage).mockImplementation(()=>{throw Error('transfer')})
    vi.advanceTimersByTime(450); expect([...pixels]).toEqual([0,0,0,0]); expect(s.state).toHaveBeenLastCalledWith('decode-error')
  })
})
