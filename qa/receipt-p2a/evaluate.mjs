import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fixtures } from './fixtures.mjs';
import { normalize } from '../scanner-d1/fixtures.mjs';
const fields = ['label','quantityMilli','unit','unitMinor','discountMinor','lineMinor'];
const headers = ['merchant','date','currency','totalMinor'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, allowed) => object(x) && Object.keys(x).every(k=>allowed.includes(k));
const text = x => x === null || (typeof x === 'string' && x.length <= 200);
const number = x => x === null || (Number.isSafeInteger(x) && x >= 0 && x <= 10000000);
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' ? normalize(a)===normalize(b) : a===b;
export function evaluate(f, result) {
  // Strict bounded input; no coercion, arithmetic repair, fuzzy matching or execution.
  if (!keys(result,['version','receiptId',...headers,'lines']) || result.version!==1 || result.receiptId!==f.id ||
      !headers.every(k=>Object.hasOwn(result,k)) || !['merchant','date','currency'].every(k=>text(result[k])) ||
      !number(result.totalMinor) || !Array.isArray(result.lines) || result.lines.length>100 ||
      result.lines.some(l=>!keys(l,['row',...fields,'uncertain']) || !Number.isInteger(l.row) || l.row<1 || l.row>100 ||
        !fields.every(k=>Object.hasOwn(l,k)) || !text(l.label) || ![null,'item','kg'].includes(l.unit) ||
        !['quantityMilli','unitMinor','discountMinor','lineMinor'].every(k=>number(l[k])) ||
        !Array.isArray(l.uncertain) || new Set(l.uncertain).size!==l.uncertain.length || l.uncertain.some(k=>!fields.includes(k))) ||
      new Set(result.lines.map(l=>l.row)).size!==result.lines.length) return { valid:false, error:'invalid-result' };
  const rows=f.lines.map(expected=>{
    const actual=result.lines.find(l=>l.row===expected.row);
    const wrong=fields.filter(k=>!actual || !equal(expected[k],actual[k]));
    const required=fields.filter(k=>expected[k]===null || wrong.includes(k) || actual?.uncertain.includes(k));
    const unflagged=wrong.filter(k=>!actual?.uncertain.includes(k));
    const ambiguityHandled=fields.filter(k=>expected[k]===null).every(k=>actual?.[k]===null && actual.uncertain.includes(k));
    const arithmetic = actual && ['quantityMilli','unitMinor','discountMinor','lineMinor'].every(k=>actual[k]!==null)
      ? actual.quantityMilli*actual.unitMinor===1000*(actual.lineMinor+actual.discountMinor) : false;
    return {row:expected.row, omitted:!actual, exact:wrong.length===0, wrong, requiredCorrections:required,
      unflagged, ambiguityHandled, arithmetic};
  });
  const extra=result.lines.filter(l=>!f.lines.some(e=>e.row===l.row)).map(l=>l.row);
  const headerErrors=headers.filter(k=>!equal(f[k],result[k]));
  const sumExact=result.lines.every(l=>l.lineMinor!==null) && result.totalMinor!==null &&
    result.lines.reduce((n,l)=>n+l.lineMinor,0)===result.totalMinor;
  return { valid:true, receiptId:f.id, rows, headerErrors, extraRows:extra,
    omissions:rows.filter(r=>r.omitted).length, exactLines:rows.filter(r=>r.exact).length, expectedLines:rows.length,
    fields:Object.fromEntries(fields.map(k=>[k,{exact:rows.filter(r=>!r.wrong.includes(k)).length,total:rows.length}])),
    correctionFields:rows.reduce((n,r)=>n+r.requiredCorrections.length,0)+headerErrors.length+extra.length,
    correctionLines:rows.filter(r=>r.requiredCorrections.length).length,
    unnecessaryFlags:result.lines.reduce((n,l)=>n+l.uncertain.filter(k=>f.lines.find(e=>e.row===l.row)?.[k]!==null && equal(f.lines.find(e=>e.row===l.row)?.[k],l[k])).length,0),
    sumExact, evidenceExact:headerErrors.length===0 && extra.length===0 && sumExact && rows.every(r=>r.exact && r.ambiguityHandled && r.arithmetic),
  };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const f=fixtures.find(f=>f.id===process.argv[2]);
    if(!f || statSync(process.argv[3]).size>1000000) throw Error();
    const bytes=readFileSync(process.argv[3]);
    if(bytes.length>1000000) throw Error();
    const score=evaluate(f,JSON.parse(bytes.toString('utf8')));
    console.log(JSON.stringify(score,null,2)); // Fixed schema, indices/metrics only; no extracted text.
    if(!score.valid) process.exitCode=1;
  } catch { console.error('invalid-input'); process.exitCode=1; }
}
