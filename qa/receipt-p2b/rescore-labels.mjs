// Offline only: reads retained synthetic responses; never imports the live runner.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fixtures} from '../receipt-p2a/fixtures.mjs';
import {extraction} from './request.mjs';
import {diagnoseLabels} from './label-diagnostic.mjs';
const root=new URL('../../artifacts/receipt-p2b-run/',import.meta.url);
const summary=JSON.parse(readFileSync(new URL('summary.json',root)));
const results=[];
for(const entry of summary.results.filter(r=>r.httpStatus===200)) {
  const fixture=fixtures.find(f=>f.id===entry.id);
  assert(fixture,'unknown fixture');
  const bytes=readFileSync(new URL(`${entry.n}-response.json`,root));
  const result={version:1,receiptId:fixture.id,...extraction(JSON.parse(bytes))};
  const scored=diagnoseLabels(fixture,result);
  assert.deepEqual(scored.strict,entry.score,'original score must remain identical');
  results.push({attempt:entry.n,fixture:fixture.id,responseSha256:createHash('sha256').update(bytes).digest('hex'),...scored});
}
console.log(JSON.stringify({offline:true,attempted:summary.attempted,results},null,2));
