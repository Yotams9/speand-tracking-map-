// Evaluator calibration only: hand-authored mutations, never model performance.
import { fixtures, idealResult } from './fixtures.mjs';
import { evaluate } from './evaluate.mjs';
const controls=[];
for(const f of fixtures) controls.push({control:'exact-visible-evidence',fixture:f.id,score:evaluate(f,idealResult(f))});
for(const [name,mutate] of [
  ['swapped-unit-prices',r=>{[r.lines[0].unitMinor,r.lines[1].unitMinor]=[r.lines[1].unitMinor,r.lines[0].unitMinor];}],
  ['omitted-repeat',r=>r.lines.splice(20,1)],
  ['wrong-total',r=>r.totalMinor++],
  ['invented-ambiguous-label',r=>r.lines[24].label='Candy'],
  ['all-lines-uncertain',r=>r.lines.forEach(l=>l.uncertain=['label','quantityMilli','unit','unitMinor','discountMinor','lineMinor'])],
]) { const f=fixtures[2],r=idealResult(f);mutate(r);controls.push({control:name,fixture:f.id,score:evaluate(f,r)}); }
console.log(JSON.stringify({version:1,kind:'constructed-evaluator-controls-NOT-OCR',modelRuns:0,controls:controls.map(({score,...c})=>{const {rows,...metrics}=score;return {...c,score:metrics};})},null,2));
