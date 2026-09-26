import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtures,idealResult} from '../receipt-p2a/fixtures.mjs';
import {evaluate} from '../receipt-p2a/evaluate.mjs';
import {diagnoseLabels,reviewedRunSwap} from './label-diagnostic.mjs';
const f=fixtures[3];
function swapped(){const r=idealResult(f);for(const l of r.lines){if(l.label){const m=l.label.match(/^([\u0590-\u05ff ]+) (.+)$/u);l.label=m[2]+' '+m[1];}}return r;}
test('24 reviewed swaps distinguished without mutating strict scores, input or truth',()=>{
 const r=swapped(),before=JSON.stringify([f,r]),s=diagnoseLabels(f,r);
 assert.equal(s.diagnostic.representationEquivalentLabels,24);assert.equal(s.diagnostic.remainingReviewFields,1);assert.equal(s.diagnostic.remainingReviewLines,1);
 assert.equal(s.strict.exactLines,1);assert.equal(s.strict.correctionFields,25);assert.equal(s.strict.evidenceExact,false);
 assert.deepEqual(s.strict,evaluate(f,r));assert.equal(JSON.stringify([f,r]),before);
});
test('exact labels require no special equivalence; short monolingual receipts unchanged',()=>{
 for(const fixture of fixtures){const r=idealResult(fixture),s=diagnoseLabels(fixture,r);assert.equal(s.diagnostic.representationEquivalentLabels,0);assert.equal(s.diagnostic.remainingReviewFields,s.strict.correctionFields);}
});
test('word order within Hebrew and Latin runs, missing words and changed package sizes fail',()=>{
 for(const [row,label] of [[12,'Oats שועל שיבולת'],[14,'oil Olive שמן'],[14,'Olive שמן'],[1,'Milk 2L חלב'],[3,'Rice 1kg אורז EXTRA'],[1,'Milk חלב 1L']])assert.equal(reviewedRunSwap(f,row,label),false);
});
test('bidi controls never accepted as representation swaps',()=>{
 for(const c of ['\u061c','\u200e','\u200f','\u202a','\u202e','\u2066','\u2069'])assert(!reviewedRunSwap(f,1,'Milk 1L חלב'+c));
});
test('different row identities cannot borrow matching labels',()=>{
 const r=swapped();[r.lines[0].label,r.lines[1].label]=[r.lines[1].label,r.lines[0].label];
 const s=diagnoseLabels(f,r);assert.equal(s.diagnostic.representationEquivalentLabels,22);assert.equal(s.diagnostic.remainingReviewFields,3);
});
test('numeric changes and false totals survive label equivalence unchanged',()=>{
 for(const k of ['quantityMilli','unitMinor','discountMinor','lineMinor']){
 const r=swapped();r.lines[0][k]++;const s=diagnoseLabels(f,r);assert(s.strict.rows[0].wrong.includes(k));assert(s.diagnostic.rows[0].remainingReviewFields.includes(k));assert.equal(s.strict.evidenceExact,false);
 }
 const r=swapped();r.totalMinor++;const s=diagnoseLabels(f,r);assert.deepEqual(s.strict.headerErrors,['totalMinor']);assert.equal(s.diagnostic.remainingReviewFields,2);
});
test('explicit uncertainty and unreadable labels still require user review',()=>{
 const r=swapped();r.lines[0].uncertain=['label'];const s=diagnoseLabels(f,r);assert.equal(s.diagnostic.remainingReviewFields,2);
 r.lines[24].label='Candy';const bad=diagnoseLabels(f,r);assert.equal(bad.strict.rows[24].ambiguityHandled,false);assert(bad.diagnostic.rows[24].remainingReviewFields.includes('label'));
});
test('omissions, extra rows and invalid schema remain strict failures',()=>{
 const r=swapped();r.lines.splice(1,1);r.lines.push({...r.lines[0],row:26});const s=diagnoseLabels(f,r);assert.equal(s.strict.omissions,1);assert.deepEqual(s.strict.extraRows,[26]);assert.equal(s.diagnostic.remainingReviewFields,8);
 r.lines.push(r.lines[0]);assert.equal(diagnoseLabels(f,r).diagnostic,null);
});
test('unreviewed or altered fixtures do not acquire equivalence',()=>{
 const r=swapped();for(const changed of [{...f,id:'new-fixture'},{...f,totalMinor:f.totalMinor+1}])assert(!reviewedRunSwap(changed,1,r.lines[0].label));
});
test('diagnostic exposes only field names and metrics, not extracted contents',()=>{
 const r=swapped();r.lines[0].label='SYNTHETIC-PRIVATE-MARKER';assert(!JSON.stringify(diagnoseLabels(f,r)).includes('SYNTHETIC-PRIVATE-MARKER'));
});
