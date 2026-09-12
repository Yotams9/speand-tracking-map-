// Focused scorer correction QA. No camera, app route, OCR tuning or raw output.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/scanner-d1',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={browser:browser.version(),numericCheckVersion:'line-context-v2',runs:[],consoleEvents:0,pageErrors:0};
try {
  const context=await browser.newContext(),page=await context.newPage();
  context.on('request',request=>{assert.equal(new URL(request.url()).origin,'http://127.0.0.1:4317');assert.equal(request.method(),'GET');assert.equal(request.postData(),null);});
  page.on('console',()=>report.consoleEvents++);page.on('pageerror',()=>report.pageErrors++);
  await page.goto('http://127.0.0.1:4317');await page.waitForFunction(()=>window.d1);
  report.adversarial=await page.evaluate(async()=>{
    const {accuracy,fixtures}=await import('/fixtures.mjs');const f=fixtures.find(f=>f.id==='english-clean'),expected=f.lines.join('\n');
    const actual=expected.replace('VAT 6.30','VAT 41.30').replace('TOTAL ILS 41.30','TOTAL ILS 6.30');
    const score=accuracy(expected,actual,f.critical);return {cer:score.cer,numericMultisetExact:score.numericMultisetExact,numericContextExact:score.numericContextExact,numericPass:score.numericPass};
  });
  assert.ok(report.adversarial.cer<=0.05);assert.equal(report.adversarial.numericMultisetExact,true);assert.equal(report.adversarial.numericPass,false);
  const fixtures=await page.evaluate(()=>window.d1.fixtures);
  for(const fixture of fixtures)for(const mode of fixture.modes){
    const result=await page.evaluate(async({id,mode})=>{const r=await window.d1.run(id,mode);return{id:r.id,mode:r.mode,code:r.code,score:r.score}},{id:fixture.id,mode});
    await page.waitForFunction(()=>!window.d1.status().occupied);
    assert.equal(result.score?.numericCheckVersion,'line-context-v2');report.runs.push(result);
  }
  assert.equal(report.runs.length,14);assert.equal(report.runs[0].score.numericPass,true);
  assert.equal(report.consoleEvents,0);assert.equal(report.pageErrors,0);
  assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});
  await context.close();
} finally {await writeFile('artifacts/scanner-d1/numeric-correction-browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
