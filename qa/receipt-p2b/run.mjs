import {readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {MODEL,ENDPOINT,makeRequest,extraction} from './request.mjs';
import {fixtures} from '../receipt-p2a/fixtures.mjs';
import {evaluate} from '../receipt-p2a/evaluate.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const readGit=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
export function validateExecutionGit(git=readGit) {
  if(git('branch','--show-current')!=='feature/spendscape-rebuild' || git('rev-parse','HEAD')!=='399fce8e8209f0ffbeb8893903a28b43d537f8aa') throw Error('git-mismatch');
  if(git('diff','--cached','--name-only'))throw Error('index-not-empty');
}
// Offline fixture/request validation is independent of HEAD and staged files.
export function prepareJobs() {
  const manifest=JSON.parse(readFileSync(resolve(root,'qa/receipt-p2a/manifest.json')));
  if(manifest.fixtures.length!==4)throw Error('fixture-mismatch');
  return manifest.fixtures.map((m,i)=>{
    if(m.id!==fixtures[i].id || m.path!==`qa/receipt-p2a/images/${m.id}.png` || JSON.stringify(m.groundTruth)!==JSON.stringify(fixtures[i]))throw Error('fixture-mismatch');
    const bytes=readFileSync(resolve(root,m.path));
    if(bytes.length!==m.bytes || sha(bytes)!==m.sha256)throw Error('fixture-mismatch');
    return {id:m.id,sha256:m.sha256,body:JSON.stringify(makeRequest(bytes))};
  });
}
export function preflight() {
  validateExecutionGit();
  return prepareJobs();
}
function save(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});}
export function resumeState(directory,jobs) {
  const summary=JSON.parse(readFileSync(resolve(directory,'summary.json')));
  const entries=readFileSync(resolve(directory,'attempts.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  if(summary.model!==MODEL || summary.maximumCalls!==12 || summary.attempted!==3 ||
    summary.results?.length!==3 || entries.length!==3)throw Error('resume-state');
  for(let i=0;i<3;i++){
    const e=entries[i],r=summary.results[i],j=jobs[i];
    if(e.n!==i+1 || e.id!==j.id || e.repeat!==1 || e.imageHash!==j.sha256 || e.requestHash!==sha(j.body) ||
      r.n!==e.n || r.id!==e.id || r.repeat!==1 ||
      (i<2 ? r.status!=='scored' || r.httpStatus!==200 : r.status!=='stopped-error' || r.httpStatus!==503))throw Error('resume-state');
  }
  return summary;
}
export async function run({jobs,key,directory,resume=false,fetcher=fetch,wait=sleep,timeoutMs=30000,log=console.log}) {
  if(jobs.length!==4 || !key)throw Error('preflight-failed');
  // Permanent single-run reservation: reruns/concurrent starts cannot spend another allowance.
  const summary=resume ? resumeState(directory,jobs) : {model:MODEL,freeTier:'user-confirmed-no-billing',maximumCalls:12,attempted:0,results:[]};
  if(resume){
    // Consume this specific recovery authorization once, even if interrupted.
    const reservation=openSync(resolve(directory,'resume-after-3.lock'),'wx',0o600);
    try{writeSync(reservation,'Authorized slots 4-12 only; never remove to retry.\n');fsyncSync(reservation);}finally{closeSync(reservation);}
  }else mkdirSync(directory,{mode:0o700});
  const journal=openSync(resolve(directory,'attempts.jsonl'),resume?'a':'wx',0o600);
  const start=summary.attempted;
  try {
    for(let slot=start;slot<12;slot++){
      const job=jobs[slot%4],repeat=Math.floor(slot/4)+1;
      if(summary.attempted)await wait(13000);
      const n=++summary.attempted;
      // Reserve before any network; interrupted/failed calls consume a slot, never retried.
      writeSync(journal,JSON.stringify({n,id:job.id,repeat,at:new Date().toISOString(),imageHash:job.sha256,requestHash:sha(job.body)})+'\n');fsyncSync(journal);
      const result={n,id:job.id,repeat,requestBytes:Buffer.byteLength(job.body)};
      const started=performance.now();
      let response;
      try {
        response=await fetcher(ENDPOINT,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:job.body,signal:AbortSignal.timeout(timeoutMs)});
        result.httpStatus=response.status;
        if(!response.ok){await response.body?.cancel();throw Error('http-error');}
        const reader=response.body.getReader();let bytes=0;const chunks=[];
        while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1000000){await reader.cancel();throw Error('response-limit');}chunks.push(Buffer.from(value));}
        result.responseBytes=bytes;result.elapsedMs=Math.round(performance.now()-started);
        const raw=Buffer.concat(chunks).toString('utf8');
        // Never persist a reflected credential or print any provider error/text.
        if(raw.includes(key))throw Error('credential-reflected');
        const body=JSON.parse(raw);
        save(resolve(directory,`${n}-response.json`),body); // Synthetic benchmark evidence only, ignored.
        const parsed=extraction(body);
        // Envelope identifiers are evaluator metadata, not facts supplied to the model.
        const score=evaluate(fixtures.find(f=>f.id===job.id),{...parsed,version:1,receiptId:job.id});
        result.score=score;
        result.usage=Object.fromEntries(['total_input_tokens','total_output_tokens','total_thought_tokens','total_tokens'].filter(k=>Number.isSafeInteger(body.usage?.[k])).map(k=>[k,body.usage[k]]));
        if(!score.valid)throw Error('invalid-extraction');
        result.status='scored';
      } catch {
        result.elapsedMs=Math.round(performance.now()-started);result.status='stopped-error';
        summary.results.push(result);save(resolve(directory,'summary.json'),summary);
        log(`Stopped at ${n}/12. Do not rerun. Report this status for review.`);return summary;
      }
      summary.results.push(result);save(resolve(directory,'summary.json'),summary);
      log(`${n}/12 scored. No receipt text printed.`);
    }
    log('Completed 12/12. Results saved locally; no model promotion implied.');return summary;
  } finally {closeSync(journal);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    const offlineCheck=process.argv.length===3 && process.argv[2]==='--check';
    const jobs=offlineCheck ? prepareJobs() : preflight();
    if(process.argv.length===3 && process.argv[2]==='--check')console.log('Offline preflight passed: 4 verified images, model gemini-3.8-flash, max 12 calls. No API call made.');
    else if(process.argv.length===3 && process.argv[2]==='--check-resume'){
      resumeState(resolve(root,'artifacts/receipt-p2b-run'),jobs);
      console.log('Offline recovery preflight passed: preserved attempts 1-3; slots 4-12 only. No API call made.');
    }
    else if(process.argv.length===4 && ['--run','--resume-after-3'].includes(process.argv[2]) && process.argv[3]==='--free-tier-confirmed'){
      const key=process.env.GEMINI_API_KEY;
      if(!key || process.env.GOOGLE_API_KEY)throw Error('key-not-configured');
      execFileSync('git',['check-ignore','artifacts/receipt-p2b-run/summary.json'],{cwd:root,stdio:'pipe'});
      const result=await run({jobs,key,directory:resolve(root,'artifacts/receipt-p2b-run'),resume:process.argv[2]==='--resume-after-3'});
      if(result.results.at(-1)?.status==='stopped-error')process.exitCode=1;
    }else throw Error('arguments');
  }catch{console.error('Preflight stopped. Check key environment, branch, fixtures or existing run directory. Do not delete run evidence to retry.');process.exitCode=1;}
}
