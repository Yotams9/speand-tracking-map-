// QA-only supplementary metric. Does not modify the strict evaluator or responses.
import {evaluate} from '../receipt-p2a/evaluate.mjs';
import {fixtures} from '../receipt-p2a/fixtures.mjs';
import {normalize} from '../scanner-d1/fixtures.mjs';
const version='reviewed-two-run-labels-v1';
const controls=/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
export function reviewedRunSwap(fixture,row,actualLabel) {
  // Only the reviewed bilingual corpus, with unchanged truth, is eligible.
  const reviewed=fixtures.find(f=>['mixed-25','mixed-25-degraded'].includes(f.id)&&f.id===fixture.id);
  if(!reviewed || JSON.stringify(fixture)!==JSON.stringify(reviewed) || typeof actualLabel!=='string' || controls.test(actualLabel))return false;
  const label=reviewed.lines.find(l=>l.row===row)?.label;
  if(typeof label!=='string')return false;
  // Two intact runs only. No token sorting, character repair or within-run reorder.
  const runs=label.match(/^([\u05d0-\u05ea]+(?: [\u05d0-\u05ea]+)*) ([A-Za-z0-9]+(?: [A-Za-z0-9]+)*)$/u);
  return !!runs && normalize(actualLabel)===runs[2]+' '+runs[1];
}
export function diagnoseLabels(fixture,result) {
  const strict=evaluate(fixture,result);
  if(!strict.valid)return {version,strict,diagnostic:null};
  const rows=strict.rows.map(r=>{
    const actual=result.lines.find(l=>l.row===r.row);
    const equivalent=r.wrong.includes('label') && reviewedRunSwap(fixture,r.row,actual?.label);
    // Explicit uncertainty still requires review even when representation matches.
    const remaining=r.requiredCorrections.filter(k=>!(k==='label' && equivalent && !actual.uncertain.includes('label')));
    return {row:r.row,reviewedRunSwap:equivalent,remainingReviewFields:remaining};
  });
  return {version,strict,diagnostic:{
    meaning:'supplementary representation review; not promotion or automatic save',
    representationEquivalentLabels:rows.filter(r=>r.reviewedRunSwap).length,
    remainingReviewFields:rows.reduce((n,r)=>n+r.remainingReviewFields.length,0)+strict.headerErrors.length+strict.extraRows.length,
    remainingReviewLines:rows.filter(r=>r.remainingReviewFields.length).length,
    rows,
  }};
}
