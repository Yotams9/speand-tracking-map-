import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const out='artifacts/scanner-d1';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={environment:{browser:browser.version(),platform:process.platform,arch:process.arch,physicalIphone:false},runs:[],lifecycle:[]};
async function context() {
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    const probe={created:0,terminated:0,active:0,maxActive:0,jobs:0,activeJobs:0,maxJobs:0,storage:0,objectUrls:0,revokedUrls:0};window.probe=probe;
    const Native=window.Worker;
    // Observation only: count job envelopes, never read image or result payloads.
    window.Worker=class extends Native {constructor(...args){super(...args);probe.created++;probe.active++;probe.maxActive=Math.max(probe.active,probe.maxActive);this.stopped=false;this.job=false;this.addEventListener('message',({data})=>{if(data.action==='recognize'&&['resolve','reject'].includes(data.status)&&this.job){this.job=false;probe.activeJobs--;}});}postMessage(message,...args){if(message.action==='recognize'){this.job=true;probe.jobs++;probe.activeJobs++;probe.maxJobs=Math.max(probe.maxJobs,probe.activeJobs);}super.postMessage(message,...args);}terminate(){if(!this.stopped){this.stopped=true;probe.terminated++;probe.active--;if(this.job){this.job=false;probe.activeJobs--;}}super.terminate();}};
    for(const name of ['setItem','getItem','removeItem','clear'])Storage.prototype[name]=function(){probe.storage++;throw Error('storage-forbidden')};
    for(const name of ['open','deleteDatabase'])indexedDB[name]=()=>{probe.storage++;throw Error('storage-forbidden')};
    for(const name of ['open','match','delete','keys','has'])caches[name]=()=>{probe.storage++;throw Error('storage-forbidden')};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=(blob)=>{probe.objectUrls++;return create(blob)};URL.revokeObjectURL=(url)=>{probe.revokedUrls++;return revoke(url)};
  });
  let requests=[],pending=[],consoleEvents=0,pageErrors=0;
  context.on('request',request=>{
    const url=new URL(request.url());assert.equal(url.origin,'http://127.0.0.1:4317');assert.equal(request.method(),'GET');assert.equal(request.postData(),null);
    requests.push({path:url.pathname,method:request.method()});
  });
  context.on('requestfinished',request=>{const entry=requests.findLast(e=>e.path===new URL(request.url()).pathname&&!e.sizes);if(entry)pending.push(request.sizes().then(s=>{entry.sizes=s}).catch(()=>{entry.unavailable=true}));});
  const page=await context.newPage();page.on('console',()=>consoleEvents++);page.on('pageerror',()=>pageErrors++);
  await page.goto('http://127.0.0.1:4317');await page.waitForFunction(()=>!!window.d1);
  let transferStart=(await (await fetch('http://127.0.0.1:4317/__metrics')).json()).length;
  return {context,page,requests,async finish(){await Promise.all(pending);const probe=await page.evaluate(()=>window.probe);const transfers=(await (await fetch('http://127.0.0.1:4317/__metrics')).json()).slice(transferStart);return{requests:[...requests],transfers,bodyBytes:transfers.reduce((n,r)=>n+r.bodyBytes,0),wireBytes:transfers.reduce((n,r)=>n+r.wireBytes,0),consoleEvents,pageErrors,probe,cookies:await context.cookies()};},async reset(){requests.length=0;pending=[];transferStart=(await (await fetch('http://127.0.0.1:4317/__metrics')).json()).length;}};
}
try {
  const app=await browser.newContext(),appPage=await app.newPage(),ocrRequests=[];
  appPage.on('request',request=>{if(/tesseract|traineddata|scanner-d1|\/vendor\/core/.test(request.url()))ocrRequests.push(new URL(request.url()).pathname)});
  await appPage.goto('http://127.0.0.1:3000');await appPage.waitForFunction(()=>window.__SPENDSCAPE_QA__?.ready);
  const baseline=await appPage.evaluate(()=>{const q=window.__SPENDSCAPE_QA__;return{purchases:q.combinedPurchaseCount,pins:q.canonicalPins,visiblePins:q.visiblePinFeatures,maps:q.mapInstanceCount,constructions:q.mapConstructionCount,total:q.analytics.totalBaseAmountIls}});
  assert.deepEqual(baseline,{purchases:42,pins:12,visiblePins:12,maps:1,constructions:1,total:6777.38});assert.deepEqual(ocrRequests,[]);
  report.application={baseline,ocrRequests};await app.close();
  const q=await context();
  report.beforeEntry=await q.finish();assert.equal(report.beforeEntry.probe.created,0);assert.equal(report.beforeEntry.requests.some(r=>r.path.startsWith('/vendor/')||r.path.startsWith('/api/')),false);
  const fixtures=await q.page.evaluate(()=>window.d1.fixtures);
  for(const fixture of fixtures)for(const mode of fixture.modes) {
    await q.reset();const result=await q.page.evaluate(async({id,mode})=>window.d1.run(id,mode),{id:fixture.id,mode});
    await q.page.waitForFunction(()=>!window.d1.status().occupied);
    const evidence=await q.finish();report.runs.push({...result,cache:report.runs.length?'warm-shared-cache':'cold-context',network:evidence.requests,transfers:evidence.transfers,bodyBytes:evidence.bodyBytes,wireBytes:evidence.wireBytes});
    assert.equal(evidence.probe.active,0);assert.equal(evidence.probe.maxActive,1);assert.equal(evidence.probe.storage,0);assert.equal(evidence.cookies.length,0);
    console.log(JSON.stringify({id:result.id,mode,code:result.code,cer:result.score?.cer,numericPass:result.score?.numericPass,timings:result.timings}));
  }
  for(let i=0;i<20;i++) {
    await q.reset();const result=await q.page.evaluate(()=>window.d1.run('mixed-clean','heb+eng'));await q.page.waitForFunction(()=>!window.d1.status().occupied);
    const evidence=await q.finish();report.runs.push({...result,cache:'warm-repeat',iteration:i+1,network:evidence.requests,transfers:evidence.transfers,bodyBytes:evidence.bodyBytes,wireBytes:evidence.wireBytes});
  }
  report.completedEvidence=await q.finish();assert.equal(report.completedEvidence.consoleEvents,0);assert.equal(report.completedEvidence.pageErrors,0);
  assert.equal(report.completedEvidence.probe.maxJobs,1);
  const cdp=await q.context.newCDPSession(q.page);report.storageUsage=await cdp.send('Storage.getUsageAndQuota',{origin:'http://127.0.0.1:4317'});
  await q.context.close();
  for(const [id,mode] of [['hebrew-clean','heb'],['mixed-clean','heb+eng']]){
    const q=await context();await q.reset();const result=await q.page.evaluate(({id,mode})=>window.d1.run(id,mode),{id,mode});await q.page.waitForFunction(()=>!window.d1.status().occupied);
    const evidence=await q.finish();report.runs.push({...result,cache:'cold-context',network:evidence.requests,transfers:evidence.transfers,bodyBytes:evidence.bodyBytes,wireBytes:evidence.wireBytes});await q.context.close();
  }
  for(const stage of ['api','worker','core','language'])for(const action of ['cancel','dispose']) {
    const q=await context();let release,hit;
    const gate=new Promise(resolve=>{release=resolve}),seen=new Promise(resolve=>{hit=resolve});
    const pattern={api:'**/api/*.js',worker:'**/worker-bootstrap.js',core:'**/vendor/core/*.js',language:'**/vendor/lang/*.traineddata'}[stage];
    await q.context.route(pattern,async route=>{hit();await gate;await route.continue().catch(()=>{});});
    await q.page.evaluate(()=>{window.pending=window.d1.run('mixed-clean','heb+eng')});
    await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('stage-not-reached')),15000))]);
    await q.page.evaluate(action=>window.d1[action](),action);
    const outcome=await q.page.evaluate(()=>window.pending);const pendingState=await q.page.evaluate(()=>({session:window.d1.status(),probe:window.probe}));
    assert.equal(outcome.code,'cancelled');assert.equal(outcome.score,null);
    release();await q.page.waitForFunction(()=>!window.d1.status().occupied,{},{timeout:25000});
    const evidence=await q.finish();assert.equal(evidence.probe.active,0);assert.equal(evidence.probe.maxActive<=1,true);
    report.lifecycle.push({stage,action,code:outcome.code,pendingState,final:evidence});await q.context.close();
  }
  for(const action of ['cancel','dispose']) {
    const q=await context();await q.page.evaluate(()=>{window.pending=window.d1.run('mixed-clean','heb+eng')});
    await q.page.waitForFunction(()=>window.d1.states.includes('recognizing'));
    await q.page.evaluate(action=>window.d1[action](),action);const outcome=await q.page.evaluate(()=>window.pending);
    await q.page.waitForFunction(()=>!window.d1.status().occupied);
    assert.equal(outcome.code,'cancelled');assert.equal(outcome.score,null);
    report.lifecycle.push({stage:'recognition',action,code:outcome.code,final:await q.finish()});await q.context.close();
  }
  {
    const q=await context();const result=await q.page.evaluate(()=>window.d1.invalid());await q.page.waitForFunction(()=>!window.d1.status().occupied);
    assert.equal(result.code,'engine-error');assert.equal(result.result,null);report.malformed={code:result.code,evidence:await q.finish()};await q.context.close();
  }
  {
    const q=await context();await q.context.route('**/vendor/lang/*.traineddata',route=>route.abort());
    const result=await q.page.evaluate(()=>window.d1.run('english-clean','eng'));
    assert.equal(result.code,'engine-error');assert.equal(result.score,null);
    report.failedLanguage={code:result.code,status:await q.page.evaluate(()=>window.d1.status()),evidence:await q.finish(),cleanup:'Browser context closed: public API supplied no handle'};
    await q.context.close();
  }
} finally {await writeFile(out+'/browser-results.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
