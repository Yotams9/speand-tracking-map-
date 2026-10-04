import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try {
  for(const stage of ['api','worker','core','language','recognition']) {
    const context=await browser.newContext(),page=await context.newPage();let created=0,closed=0,release;
    page.on('worker',worker=>{created++;worker.on('close',()=>closed++);});
    await page.goto('http://127.0.0.1:4317');await page.waitForFunction(()=>window.d1);
    if(stage!=='recognition') {
      let reached;const seen=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>release=resolve);
      await context.route({api:'**/api/*.js',worker:'**/worker-bootstrap.js',core:'**/vendor/core/*.js',language:'**/vendor/lang/*.traineddata'}[stage],async route=>{reached();await gate;await route.continue().catch(()=>{});});
      await page.evaluate(()=>{void window.d1.run('mixed-clean','heb+eng')});await seen;
    } else {
      await page.evaluate(()=>{void window.d1.run('mixed-clean','heb+eng')});await page.waitForFunction(()=>window.d1.states.includes('recognizing'));
    }
    await page.close();release?.();await context.close();assert.equal(closed,created);
    results.push({case:'actual-page-close',stage,created,closed});
  }
  {
    const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:4317');await page.waitForFunction(()=>window.d1);
    let reached,release;const seen=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>release=resolve);
    await context.route('**/vendor/lang/*.traineddata',async route=>{reached();await gate;await route.continue();});
    await page.evaluate(()=>{window.first=window.d1.run('english-clean','eng')});await seen;
    await page.evaluate(()=>window.d1.cancel());assert.equal((await page.evaluate(()=>window.first)).code,'cancelled');
    assert.equal((await page.evaluate(()=>window.d1.run('english-clean','eng'))).code,'busy');
    release();await page.waitForFunction(()=>!window.d1.status().occupied);await context.unroute('**/vendor/lang/*.traineddata');
    const fresh=await page.evaluate(()=>window.d1.run('english-clean','eng'));assert.equal(fresh.code,'success');assert.equal(fresh.score.cer,0);
    await page.reload();await page.waitForFunction(()=>window.d1);assert.equal(await page.locator('#status').textContent(),'idle');
    assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});results.push({case:'cancel-blocks-overlap-late-cleanup-fresh-run-reload',passed:true});await context.close();
  }
} finally {await writeFile('artifacts/scanner-d1/cleanup-results.json',JSON.stringify(results,null,2)+'\n');await browser.close();}
