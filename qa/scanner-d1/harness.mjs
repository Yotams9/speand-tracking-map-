import { createOcrSession } from './session.mjs';
import { fixtures, renderFixture, accuracy } from './fixtures.mjs';
const states=[];
const session=createOcrSession({loadApi:()=>import('/api/tesseract.esm.min.js').then(module=>module.default),publish:code=>{states.push(code);document.querySelector('#status').textContent=code;}});
const paths={workerPath:location.origin+'/worker-bootstrap.js',corePath:location.origin+'/vendor/core',langPath:location.origin+'/vendor/lang'};
let inputGeneration=0;
async function run(id='english-clean',mode='eng') {
  const generation=++inputGeneration;
  const fixture=fixtures.find(item=>item.id===id);
  if(!fixture || !fixture.modes.includes(mode))return {code:'fixture-error'};
  states.length=0;performance.clearResourceTimings();
  let input=await renderFixture(fixture);
  if(generation!==inputGeneration){input.fill(0);return {code:'cancelled'};}
  const task=session.start(input,mode,paths);input=null;
  const outcome=await task;
  const score=outcome.result===null?null:accuracy(fixture.lines.join('\n'),outcome.result,fixture.critical);
  outcome.result=null;
  return {id,mode,code:outcome.code,score,timings:outcome.timings,states:[...new Set(states)],
    resources:performance.getEntriesByType('resource').map(entry=>({path:new URL(entry.name).pathname,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize})),
    memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,scope:'Chromium JS heap only; excludes complete WASM/GPU/process accounting'}:null};
}
function cancel(){inputGeneration++;session.cancel();document.querySelector('#status').textContent='cancelled';}
function dispose(){inputGeneration++;session.dispose();}
window.d1={run,cancel,dispose,status:session.status,states,invalid:()=>session.start(new Uint8Array([0,1,2,3]),'eng',paths),fixtures:fixtures.map(({id,modes})=>({id,modes}))};
document.querySelector('#run').onclick=()=>void run();document.querySelector('#cancel').onclick=cancel;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')cancel();});
window.addEventListener('pagehide',dispose);
