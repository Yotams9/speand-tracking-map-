import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accuracy,fixtures} from './fixtures.mjs';
const english=fixtures.find(f=>f.id==='english-clean');
const score=(fixture,lines)=>accuracy(fixture.lines.join('\n'),lines.join('\n'),fixture.critical);
function swapEndValues(fixture,left,right) {
  const lines=[...fixture.lines],a=lines[left].split(' ').at(-1),b=lines[right].split(' ').at(-1);
  lines[left]=lines[left].slice(0,-a.length)+b;lines[right]=lines[right].slice(0,-b.length)+a;
  return lines;
}
for(const id of ['english-clean','hebrew-clean','mixed-clean'])test(`${id}: swapped VAT/total cannot pass despite identical numeric multiset`,()=>{
  const f=fixtures.find(f=>f.id===id),result=score(f,swapEndValues(f,6,7));
  assert.equal(result.numericMultisetExact,true);assert.equal(result.numericContextExact,false);assert.equal(result.numericPass,false);
  if(id==='english-clean')assert.ok(result.cer<=0.05,'original false-positive must still pass CER alone');
});
test('subtotal/total swap fails',()=>{
  const result=score(english,swapEndValues(english,5,7));assert.equal(result.numericMultisetExact,true);assert.equal(result.numericPass,false);
});
test('unit prices exchanged between item lines fail even if every number remains',()=>{
  const lines=[...english.lines];lines[3]=lines[3].replace('12.50','10.00');lines[4]=lines[4].replace('10.00','12.50');
  const result=score(english,lines);assert.equal(result.numericMultisetExact,true);assert.equal(result.numericPass,false);
});
test('unit price and line amount exchanged within one line fail',()=>{
  const lines=[...english.lines];lines[3]=lines[3].replace('12.50','TEMP').replace('25.00','12.50').replace('TEMP','25.00');
  const result=score(english,lines);assert.equal(result.numericMultisetExact,true);assert.equal(result.numericPass,false);
});
test('dates on the wrong labelled lines fail',()=>{
  const result=accuracy('DATE 2026-09-09\nPRINTED 2026-09-10','DATE 2026-09-10\nPRINTED 2026-09-09',['2026-09-09','2026-09-10']);
  assert.equal(result.numericMultisetExact,true);assert.equal(result.numericPass,false);
});
test('exact expected text and harmless within-line whitespace pass for every fixture',()=>{
  for(const f of fixtures){assert.equal(score(f,f.lines).numericPass,true);assert.equal(score(f,f.lines.map(line=>'  '+line.replaceAll(' ','\t  ')+'  ')).numericPass,true);}
});
test('CRLF and extra blank lines preserve line context',()=>{
  const result=accuracy(english.lines.join('\n'),english.lines.join('\r\n\r\n'),english.critical);assert.equal(result.numericPass,true);assert.equal(result.cer,0);
});
test('merged or reordered numeric lines remain unverified',()=>{
  assert.equal(score(english,[english.lines.join(' ')]).numericPass,false);
  const lines=[...english.lines];[lines[5],lines[6]]=[lines[6],lines[5]];assert.equal(score(english,lines).numericPass,false);
});
test('changed labels, signs, missing numbers and extra numeric lines fail closed',()=>{
  for(const actual of ['PAYMENT 41.30','TOTAL -41.30','TOTAL 4I.30','TOTAL','TOTAL 41.30\nTOTAL 41.30'])assert.equal(accuracy('TOTAL 41.30',actual,['41.30']).numericPass,false);
});
test('output exposes only context indices/booleans, never recognized text or labels',()=>{
  const result=accuracy('SYNTHETIC_PRIVATE_MARKER 41.30','SYNTHETIC_PRIVATE_MARKER 41.30',['41.30']);
  assert.deepEqual(result.numericContext,[{index:0,exact:true}]);assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'),false);
});
