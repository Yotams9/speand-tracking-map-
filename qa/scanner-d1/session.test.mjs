import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOcrSession} from './session.mjs';
import {accuracy,normalize} from './fixtures.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(stage='init',limits={}) {
  const init=deferred(),recognition=deferred(),apiLoad=deferred(),states=[];
  let created=0,terminated=0,jobs=0;
  const worker={terminate:async()=>{terminated++},recognize:()=>{jobs++;return recognition.promise}};
  const api={createWorker:()=>{created++;return init.promise}};
  const session=createOcrSession({loadApi:()=>stage==='api'?apiLoad.promise:Promise.resolve(api),publish:s=>states.push(s),...limits});
  return {session,init,recognition,apiLoad,api,worker,states,counts:()=>({created,terminated,jobs})};
}
for(const action of ['cancel','dispose'])for(const stage of ['api','init','recognition']) {
  test(`${action} during ${stage}: clears bytes, rejects late result, no second worker`,async()=>{
    const q=setup(stage),bytes=new Uint8Array([1,2,3]),run=q.session.start(bytes,'eng',{});await tick();
    if(stage==='recognition'){q.init.resolve(q.worker);await tick();}
    q.session[action]();assert.equal((await run).code,'cancelled');assert.deepEqual([...bytes],[0,0,0]);
    if(stage==='init')assert.equal((await q.session.start(new Uint8Array([1]),'eng',{})).code,action==='dispose'?'disposed':'busy');
    q.apiLoad.resolve(q.api);q.init.resolve(q.worker);q.recognition.resolve({data:{text:'late synthetic result'}});await tick();await tick();
    assert.equal(q.session.status().occupied,false);assert.equal(q.states.includes('success'),false);
    assert.equal(q.counts().terminated,stage==='api'?0:1);
  });
}
test('initialization watchdog settles caller, retains exclusive slot, terminates late handle',async()=>{
  const q=setup('init',{initMs:5});const run=q.session.start(new Uint8Array([1]),'eng',{});
  assert.equal((await run).code,'init-timeout');assert.equal(q.session.status().occupied,true);
  q.init.resolve(q.worker);await tick();assert.equal(q.counts().terminated,1);assert.equal(q.session.status().occupied,false);
});
test('public initialization promise that never settles cannot be forcibly cleaned: explicit limitation',async()=>{
  const q=setup();const run=q.session.start(new Uint8Array([1]),'eng',{});await tick();q.session.cancel();await run;
  assert.equal(q.session.status().pendingHandle,true);assert.equal(q.counts().terminated,0);
  q.init.resolve(q.worker);await tick();
});
test('20 completed cycles have exactly one job and termination per cycle',async()=>{
  let active=0,max=0,jobs=0,ends=0;
  const session=createOcrSession({loadApi:async()=>({createWorker:async()=>{active++;max=Math.max(max,active);return{recognize:async()=>{jobs++;return{data:{text:'synthetic'}}},terminate:async()=>{active--;ends++}}}}),publish:()=>{}});
  for(let i=0;i<20;i++){assert.equal((await session.start(new Uint8Array([1]),'eng',{})).code,'success');await tick();}
  assert.deepEqual({active,max,jobs,ends},{active:0,max:1,jobs:20,ends:20});
});
test('recognition failure is fixed-code and releases worker',async()=>{
  const q=setup();const run=q.session.start(new Uint8Array([1]),'eng',{});await tick();q.init.resolve(q.worker);await tick();q.recognition.reject(Error('private payload'));
  const result=await run;await tick();assert.equal(result.code,'engine-error');assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(q.counts().terminated,1);
});
test('normalization preserves factual characters and exact critical matching rejects substitutions',()=>{
  assert.equal(normalize(' A\n  O.00 '),'A O.00');
  assert.equal(accuracy('TOTAL 10.00','TOTAL 1O.00',['10.00']).numericPass,false);
  assert.equal(accuracy('TOTAL 10.00','TOTAL 110.00',['10.00']).numericPass,false);
  assert.equal(accuracy('שלום\n10.00','שלום 10.00',['10.00']).cer,0);
});
