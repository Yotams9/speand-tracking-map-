import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReceiptImageSession, type ImagePorts, type ImageState } from './image-session'
import { fictionalOcr } from './ocr-fixtures'
import { parseOcrReceipt } from './ocr-parser'
const file = new File(['fictional'], 'synthetic-secret-name.png', {type:'image/png'})
function setup(inspect: ImagePorts['inspect'] = async () => ({mime:'image/png',width:100,height:100}), extract: ImagePorts['extract'] = async () => parseOcrReceipt(fictionalOcr('one')).observations) {
  const states: ImageState[] = [], complete = vi.fn(), revokeUrl = vi.fn(), createUrl = vi.fn(()=>'blob:ephemeral')
  const session = new ReceiptImageSession({inspect,extract,createUrl,revokeUrl,complete,state:s=>states.push(s)},100)
  return {session,states,complete,revokeUrl,createUrl}
}
afterEach(()=>vi.useRealTimers())
describe('transient image job lifecycle',()=>{
  it('creates no draft until Read and releases preview on completion',async()=>{
    const s=setup();await s.session.select(file);expect(s.complete).not.toHaveBeenCalled();expect(s.states.at(-1)?.phase).toBe('ready')
    await s.session.read();expect(s.complete).toHaveBeenCalledTimes(1);expect(s.revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:ephemeral');expect(s.states.at(-1)?.preview).toBeNull();s.session.dispose()
  })
  it('rejects late inspection after cancel and unmount without allocating a preview',async()=>{
    for(const exit of ['cancel','dispose'] as const){let resolve!: (v:{mime:'image/png';width:number;height:number})=>void;const s=setup(()=>new Promise(r=>resolve=r));const task=s.session.select(file);s.session[exit]();resolve({mime:'image/png',width:100,height:100});await task;expect(s.createUrl).not.toHaveBeenCalled();expect(s.complete).not.toHaveBeenCalled()}
  })
  it('rejects late OCR after cancellation and replacement',async()=>{
    let resolve!: (v:unknown)=>void;const s=setup(undefined,()=>new Promise(r=>resolve=r));await s.session.select(file);const job=s.session.read();s.session.cancel();await s.session.select(file);resolve(parseOcrReceipt(fictionalOcr('one')).observations);await job;expect(s.complete).not.toHaveBeenCalled();expect(s.states.at(-1)?.phase).toBe('ready');s.session.dispose();expect(s.revokeUrl).toHaveBeenCalledTimes(2)
  })
  it('permits one job and no automatic retry on infrastructure failure',async()=>{
    const extract=vi.fn(async()=>{throw new Error('synthetic-private-payload')});const s=setup(undefined,extract);await s.session.select(file);await Promise.all([s.session.read(),s.session.read()]);expect(extract).toHaveBeenCalledTimes(1);expect(s.states.at(-1)).toEqual({phase:'error',preview:null,code:'ocr-invalid'});expect(JSON.stringify(s.states)).not.toContain('synthetic-private');s.session.dispose()
  })
  it('times out bounded validation and OCR and rejects obsolete completion',async()=>{
    vi.useFakeTimers();for(const stage of ['inspection','recognition']){
      let resolve!: (v:unknown)=>void
      const pending=()=>new Promise<unknown>(r=>resolve=r)
      const s=stage==='inspection'?setup(pending as ImagePorts['inspect']):setup(undefined,pending)
      let job:Promise<void>;if(stage==='inspection')job=s.session.select(file);else{await s.session.select(file);job=s.session.read()}
      await vi.advanceTimersByTimeAsync(100);expect(s.states.at(-1)).toEqual({phase:'error',preview:null,code:'timeout'})
      resolve(stage==='inspection'?{mime:'image/png',width:100,height:100}:parseOcrReceipt(fictionalOcr('one')).observations);await job;expect(s.complete).not.toHaveBeenCalled();s.session.dispose();expect(vi.getTimerCount()).toBe(0)
    }
  })
  it('never forwards a malformed OCR result and preserves honest unavailable state',async()=>{
    for(const extract of [async()=>({lines:[]}),async()=>{throw new Error('ocr-unavailable')}]){const s=setup(undefined,extract);await s.session.select(file);await s.session.read();expect(s.complete).not.toHaveBeenCalled();expect(s.states.at(-1)?.preview).toBeNull();s.session.dispose()}
  })
  it('repeated start/stop cycles balance all URLs without retaining file names',async()=>{
    const s=setup();for(let i=0;i<5;i++){await s.session.select(file);s.session.cancel()};s.session.dispose();expect(s.createUrl).toHaveBeenCalledTimes(5);expect(s.revokeUrl).toHaveBeenCalledTimes(5);expect(JSON.stringify(s.states)).not.toContain(file.name)
  })
})
