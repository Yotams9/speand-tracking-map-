import test from 'node:test';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run,prepareJobs,validateExecutionGit} from './run.mjs';
import {MODEL,ENDPOINT,extraction} from './request.mjs';
import {fixtures,idealResult} from '../receipt-p2a/fixtures.mjs';
const temp=()=>mkdtempSync(join(tmpdir(),'spendscape-p2b-test-'));
const answer=f=>{const {version,receiptId,...data}=idealResult(f);return {status:'completed',model:MODEL,steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(data)}]}]};};
test('offline preflight freezes four images; request contains no expected answers',()=>{
 const jobs=prepareJobs();assert.equal(jobs.length,4);
 for(const j of jobs){const b=JSON.parse(j.body);assert.equal(b.store,false);assert.equal(b.model,MODEL);assert(!b.tools);assert(!b.previous_interaction_id);assert(!j.body.includes('groundTruth'));assert.equal(b.input.length,2);assert(!b.input[0].text.includes('37830'));}
});
test('mock run sends exactly 12 calls, spaces them, saves scores and refuses rerun',async()=>{
 const parent=temp(),directory=join(parent,'run'),logs=[];let count=0,waits=0;
 try{
 const jobs=prepareJobs();
 const fetcher=async(url,options)=>{assert.equal(url,ENDPOINT);assert.equal(options.redirect,'error');assert.equal(options.headers['x-goog-api-key'],'FAKE-SECRET');assert(options.signal);const f=fixtures[count++%4];return new Response(JSON.stringify(answer(f)),{status:200});};
 const args={jobs,key:'FAKE-SECRET',directory,fetcher,wait:async ms=>{assert.equal(ms,13000);waits++;},log:t=>logs.push(t)};
 const s=await run(args);assert.equal(count,12);assert.equal(waits,11);assert.equal(s.results.length,12);assert(s.results.every(r=>r.score.evidenceExact));
 await assert.rejects(run(args));assert.equal(count,12);
 assert(!JSON.stringify(logs).includes('FAKE-SECRET'));assert(!readFileSync(join(directory,'summary.json'),'utf8').includes('FAKE-SECRET'));
 assert.equal(readFileSync(join(directory,'attempts.jsonl'),'utf8').trim().split('\n').length,12);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('HTTP quota failure stops after one attempt, without error-body logging or retries',async()=>{
 const parent=temp();let count=0;
 try{const s=await run({jobs:prepareJobs(),key:'FAKE-SECRET',directory:join(parent,'run'),fetcher:async()=>{count++;return new Response('DO NOT LOG',{status:429});},wait:async()=>{},log:()=>{}});assert.equal(count,1);assert.equal(s.results[0].status,'stopped-error');assert.equal(s.results[0].httpStatus,429);}finally{rmSync(parent,{recursive:true,force:true});}
});
test('transport failure and invalid response stop, consume attempt and do not expose details',async()=>{
 for(const fetcher of [async()=>{throw Error('FAKE-SECRET');},async()=>new Response('{}')]){
 const parent=temp();try{const s=await run({jobs:prepareJobs(),key:'FAKE-SECRET',directory:join(parent,'run'),fetcher,wait:async()=>{},log:()=>{}});assert.equal(s.attempted,1);assert.equal(s.results[0].status,'stopped-error');assert(!JSON.stringify(s).includes('FAKE-SECRET'));}finally{rmSync(parent,{recursive:true,force:true});}}
});
test('wrong model, pending state and absent structured text fail closed',()=>{
 for(const b of [{...answer(fixtures[0]),model:'another-model'},{...answer(fixtures[0]),status:'in_progress'},{}])assert.throws(()=>extraction(b));
});
async function stoppedAtThree(directory,jobs){
 let count=0;
 return run({jobs,key:'FAKE-SECRET',directory,wait:async()=>{},log:()=>{},fetcher:async()=>{
  const i=count++;return i===2?new Response('',{status:503}):new Response(JSON.stringify(answer(fixtures[i])));
 }});
}
test('approved resume appends exactly nine slots, keeps failed third and refuses further run',async()=>{
 const parent=temp(),directory=join(parent,'run'),jobs=prepareJobs();
 try{
 const original=await stoppedAtThree(directory,jobs);
 const journalBefore=readFileSync(join(directory,'attempts.jsonl'),'utf8');
 const responseBefore=readFileSync(join(directory,'1-response.json'));
 let count=0;const ids=[];
 const s=await run({jobs,key:'FAKE-SECRET',directory,resume:true,wait:async ms=>assert.equal(ms,13000),log:()=>{},fetcher:async(url,o)=>{
  const i=(count+++3)%4;ids.push(fixtures[i].id);assert.equal(o.body,jobs[i].body);return new Response(JSON.stringify(answer(fixtures[i])));
 }});
 assert.equal(count,9);assert.equal(s.attempted,12);assert.deepEqual(s.results.slice(0,3),original.results);
 assert.equal(ids[0],'mixed-25-degraded');assert.equal(ids.filter(id=>id==='mixed-25').length,2);
 assert(readFileSync(join(directory,'attempts.jsonl'),'utf8').startsWith(journalBefore));
 assert.deepEqual(readFileSync(join(directory,'1-response.json')),responseBefore);
 assert.deepEqual(readFileSync(join(directory,'attempts.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l).n),[1,2,3,4,5,6,7,8,9,10,11,12]);
 await assert.rejects(run({jobs,key:'FAKE-SECRET',directory,resume:true}));
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('resume stops on next error, rejects concurrency and cannot consume approval twice',async()=>{
 const parent=temp(),directory=join(parent,'run'),jobs=prepareJobs();
 try{
 await stoppedAtThree(directory,jobs);let release;const gate=new Promise(r=>release=r);let count=0;
 const args={jobs,key:'FAKE-SECRET',directory,resume:true,log:()=>{},wait:()=>gate,fetcher:async()=>{count++;return new Response('',{status:503});}};
 const running=run(args);await assert.rejects(run(args));release();
 const s=await running;assert.equal(count,1);assert.equal(s.attempted,4);assert.equal(s.results[3].httpStatus,503);
 await assert.rejects(run(args));assert.equal(count,1);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('resume rejects altered requests or journal mismatch before network',async()=>{
 const parent=temp(),directory=join(parent,'run'),jobs=prepareJobs();let count=0;
 try{
 await stoppedAtThree(directory,jobs);
 const changed=structuredClone(jobs);changed[0].body+=' ';
 await assert.rejects(run({jobs:changed,key:'FAKE-SECRET',directory,resume:true,fetcher:async()=>{count++;}}));assert.equal(count,0);
 }finally{rmSync(parent,{recursive:true,force:true});}
});

test('live Git gate keeps exact branch, approved HEAD and empty-index restrictions',()=>{
 const baseline={'branch --show-current':'feature/spendscape-rebuild','rev-parse HEAD':'399fce8e8209f0ffbeb8893903a28b43d537f8aa','diff --cached --name-only':''};
 const git=overrides=>(...args)=>({...baseline,...overrides})[args.join(' ')];
 assert.doesNotThrow(()=>validateExecutionGit(git({})));
 assert.throws(()=>validateExecutionGit(git({'branch --show-current':'main'})),/git-mismatch/);
 assert.throws(()=>validateExecutionGit(git({'rev-parse HEAD':'1111111111111111111111111111111111111111'})),/git-mismatch/);
 assert.throws(()=>validateExecutionGit(git({'diff --cached --name-only':'qa/receipt-p2b/run.mjs'})),/index-not-empty/);
});
test('offline jobs and CLI check work with all Git and network calls forbidden',()=>{
 const moduleUrl=new URL('./run.mjs',import.meta.url).href;
 const script=`
 import cp from 'node:child_process';
 import {syncBuiltinESMExports} from 'node:module';
 import {fileURLToPath} from 'node:url';
 cp.execFileSync=()=>{throw Error('git-forbidden');};syncBuiltinESMExports();
 globalThis.fetch=()=>{throw Error('network-forbidden');};
 process.argv=[process.execPath,fileURLToPath(${JSON.stringify(moduleUrl)}),'--check'];
 const {prepareJobs}=await import(${JSON.stringify(moduleUrl)});
 if(prepareJobs().length!==4)throw Error('missing-jobs');
 `;
 const output=execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});
 assert.match(output,/4 verified images/);
});
