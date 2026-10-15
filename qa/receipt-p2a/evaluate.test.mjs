import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fixtures, idealResult } from './fixtures.mjs';
import { evaluate } from './evaluate.mjs';
// Fail if evaluator/fixture code ever tries to use network in this process.
globalThis.fetch=()=>{throw Error('network-forbidden');};
const f=fixtures[2];
const altered=fn=>{const r=idealResult(f);fn(r);return evaluate(f,r);};
test('truth arithmetic and exact supplied controls across four fixtures',()=>{
  for(const f of fixtures){assert.equal(f.totalMinor,f.lines.reduce((n,l)=>n+l.lineMinor,0));
    assert(f.lines.every(l=>Number.isSafeInteger(l.lineMinor)&&l.quantityMilli*l.unitMinor===1000*(l.lineMinor+l.discountMinor)));
    const s=evaluate(f,idealResult(f));assert(s.evidenceExact);assert.equal(s.correctionFields,f.lines.length===25?1:0);}
});
test('same numeric bag swapped between lines fails exact contextual evidence',()=>{
  const s=altered(r=>{[r.lines[0].unitMinor,r.lines[1].unitMinor]=[r.lines[1].unitMinor,r.lines[0].unitMinor];});
  assert(!s.evidenceExact);assert.equal(s.fields.unitMinor.exact,23);assert.equal(s.correctionLines,3);
});
test('wrong quantity, discount and total independently fail',()=>{
  for(const field of ['quantityMilli','discountMinor','lineMinor']){const s=altered(r=>r.lines[0][field]++);assert(!s.evidenceExact);assert(s.rows[0].wrong.includes(field));}
  assert.deepEqual(altered(r=>r.totalMinor++).headerErrors,['totalMinor']);
});
test('omission and extra item cannot be hidden by correct grand total',()=>{
  const s=altered(r=>r.lines.splice(1,1));assert.equal(s.omissions,1);assert(!s.evidenceExact);
  const e=altered(r=>r.lines.push({...r.lines[0],row:26}));assert.deepEqual(e.extraRows,[26]);assert(!e.evidenceExact);
});
test('repeated items remain separate occurrences; array ordering is immaterial',()=>{
  assert.equal(f.lines[0].label,f.lines[20].label);
  assert(!altered(r=>r.lines.splice(20,1)).evidenceExact);
  assert(altered(r=>r.lines.reverse()).evidenceExact);
});
test('ambiguous line requires null plus explicit uncertainty; guessing fails',()=>{
  assert(!altered(r=>r.lines[24].label='Candy').evidenceExact);
  assert(!altered(r=>r.lines[24].uncertain=[]).evidenceExact);
  assert.equal(altered(()=>{}).correctionFields,1);
});
test('unnecessary uncertainty increases correction burden',()=>{
  const s=altered(r=>r.lines[0].uncertain=['label']);assert.equal(s.unnecessaryFlags,1);assert.equal(s.correctionFields,2);
});
test('strict schema rejects coercion, duplicate IDs, unknown keys, oversized values',()=>{
  for(const mutate of [r=>r.lines[0].unitMinor='720',r=>r.lines.push(r.lines[0]),r=>r.command='save',r=>r.lines[0].unitMinor=Infinity,r=>r.lines[0].label='x'.repeat(201),r=>delete r.currency])
    assert.equal(altered(mutate).valid,false);
  for(const bad of [null,[],{},'text'])assert.equal(evaluate(f,bad).valid,false);
});
test('no O/0 repair, invented currency/date or silent label substitution',()=>{
  assert(!altered(r=>r.currency='USD').evidenceExact);
  assert(!altered(r=>r.date='2026-09-21').evidenceExact);
  assert(!altered(r=>r.lines[0].label=r.lines[0].label.replace('1','O')).evidenceExact);
});
test('null numeric fields are unresolved, not zero or derived from other fields',()=>{
  const s=altered(r=>{r.lines[0].unitMinor=null;r.lines[0].uncertain=['unitMinor'];});
  assert(!s.evidenceExact);assert.equal(s.rows[0].arithmetic,false);assert(s.rows[0].requiredCorrections.includes('unitMinor'));
});
test('checked-in images and manifest match source ground truth and SHA-256',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url)));
  assert.equal(manifest.fixtures.length,4);
  manifest.fixtures.forEach((m,i)=>{assert.deepEqual(m.groundTruth,fixtures[i]);const b=readFileSync(m.path);assert.equal(b.length,m.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),m.sha256);assert.equal(b.subarray(1,4).toString(),'PNG');});
});
test('score output excludes supplied labels and receipt contents',()=>{
  const r=idealResult(f);r.merchant='PRIVATE-SYNTHETIC-MARKER';r.lines[0].label='PRIVATE-SYNTHETIC-MARKER';
  assert(!JSON.stringify(evaluate(f,r)).includes('PRIVATE-SYNTHETIC-MARKER'));
});
