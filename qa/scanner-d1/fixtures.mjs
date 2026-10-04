// Entirely fictional OCR evidence, independent of canonical Spendscape fixtures.
const english = ['SYNTHETIC RECEIPT', 'EXAMPLE CAFE', '2026-09-09', 'COFFEE 2 x 12.50 = 25.00', 'CAKE 1 x 10.00 = 10.00', 'SUBTOTAL 35.00', 'VAT 6.30', 'TOTAL ILS 41.30'];
const hebrew = ['קבלה סינתטית', 'מכולת ניסוי', '2026-09-09', 'לחם 2 x 10.00 = 20.00', 'אורז 1 x 30.00 = 30.00', 'סכום ביניים 50.00', 'מע״מ 9.00', 'סה״כ ₪ 59.00'];
const mixed = ['קבלה סינתטית', 'חנות הדגמה', '2026-09-09', 'DEMO PEN 2 x 25.00 = 50.00', 'DEMO BOOK 1 x 50.00 = 50.00', 'SUBTOTAL 100.00', 'מע״מ 18.00', 'TOTAL ILS 118.00'];
export const fixtures = [
  { id: 'english-clean', lines: english, modes: ['eng', 'heb+eng'], clean: true, critical: ['2026-09-09','12.50','25.00','10.00','35.00','6.30','41.30'] },
  { id: 'hebrew-clean', lines: hebrew, modes: ['heb', 'heb+eng'], clean: true, critical: ['2026-09-09','10.00','20.00','30.00','50.00','9.00','59.00'] },
  { id: 'mixed-clean', lines: mixed, modes: ['heb+eng'], clean: true, critical: ['2026-09-09','25.00','50.00','100.00','18.00','118.00'] },
  ...['rotate90','rotate180','skew','blur','low-contrast'].map(transform => ({id: `mixed-${transform}`, lines: mixed, modes: ['heb+eng'], transform, critical: ['2026-09-09','25.00','50.00','100.00','18.00','118.00']})),
  { id: 'blank', lines: [], modes: ['heb+eng'], critical: [], expectEmpty: true },
  { id: 'non-receipt', lines: ['SYNTHETIC LANDSCAPE', 'THIS IS NOT A RECEIPT'], modes: ['heb+eng'], critical: [] },
  { id: 'conflicting-total', lines: ['SYNTHETIC RECEIPT', 'EXAMPLE SHOP', '2026-09-09','SUBTOTAL 100.00','VAT 18.00','TOTAL ILS 119.00'], modes: ['heb+eng'], critical: ['2026-09-09','100.00','18.00','119.00'], intentionalConflict: true },
  { id: 'multiple-totals', lines: ['SYNTHETIC RECEIPT','EXAMPLE SHOP','2026-09-09','SUBTOTAL 100.00','TOTAL ILS 118.00','TOTAL ILS 128.00'], modes: ['heb+eng'], critical: ['2026-09-09','100.00','118.00','128.00'], intentionalConflict: true },
];
// CER: NFC, Unicode whitespace collapsed, trim. No case/digit/punctuation/bidi repair.
export const normalize = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
export function accuracy(expected, actual, critical) {
  const a = [...normalize(expected)], b = [...normalize(actual)];
  let row = Array.from({length:b.length+1}, (_, i) => i);
  for (let i=1;i<=a.length;i++) {
    const next = [i];
    for (let j=1;j<=b.length;j++) next[j] = Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row = next;
  }
  const tokens = normalize(actual).split(/\s+/u);
  // OCR evidence only: compare the complete numeric-token multiset including
  // repeated amounts/quantities. No field parsing, inferred labels or repair.
  const numbers = text => (normalize(text).match(/\d{4}-\d{2}-\d{2}|\d+(?:[.,]\d+)?/gu) ?? []).sort();
  const numericMultisetExact = JSON.stringify(numbers(expected)) === JSON.stringify(numbers(actual));
  // A matching bag of numbers cannot prove they belong to the right receipt
  // lines. For these fixed fixtures, require each numeric line's full context
  // in order. Whitespace within lines/blank lines is harmless; missing, merged,
  // reordered or relabelled numeric lines remain unverified. This is a strict
  // fixture oracle, not a receipt parser, field inference or OCR correction.
  const numericLines = text => text.split(/\r\n?|\n|\u2028|\u2029/u)
    .map(normalize).filter(line => /\d/u.test(line));
  const expectedLines = numericLines(expected), actualLines = numericLines(actual);
  const numericContext = expectedLines.map((line,index) => ({ index, exact: line === actualLines[index] }));
  const numericContextExact = expectedLines.length === actualLines.length && numericContext.every(line => line.exact);
  return { cer: a.length ? row[b.length]/a.length : (b.length ? 1 : 0), expectedCharacters: a.length, actualCharacters: b.length,
    critical: critical.map((value,index) => ({index, exact: tokens.includes(value)})),
    numericCheckVersion: 'line-context-v2', numericContext, numericContextExact,
    numericMultisetExact, numericPass: numericMultisetExact && numericContextExact && critical.every(value => tokens.includes(value)) };
}
export async function renderFixture(fixture) {
  const base = document.createElement('canvas'); base.width=1400; base.height=950;
  const ctx=base.getContext('2d'); ctx.fillStyle='white';ctx.fillRect(0,0,1400,950);
  ctx.fillStyle=fixture.transform==='low-contrast'?'#bcbcbc':'#111'; ctx.font='42px Arial';ctx.textBaseline='top';
  fixture.lines.forEach((line,index)=>{
    const rtl=/[\u0590-\u05ff]/u.test(line); ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';
    ctx.fillText(line,rtl?1300:100,80+index*95);
  });
  const output=document.createElement('canvas');
  output.width=fixture.transform==='rotate90'?950:1400;output.height=fixture.transform==='rotate90'?1400:950;
  const target=output.getContext('2d');target.fillStyle='white';target.fillRect(0,0,output.width,output.height);
  if(fixture.transform==='rotate90'){target.translate(950,0);target.rotate(Math.PI/2);}
  if(fixture.transform==='rotate180'){target.translate(1400,950);target.rotate(Math.PI);}
  if(fixture.transform==='skew'){target.translate(45,0);target.transform(1,0.025,-0.045,1,0,0);}
  if(fixture.transform==='blur')target.filter='blur(2px)';
  target.drawImage(base,0,0); base.width=0;base.height=0;
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
  output.width=0;output.height=0;
  if(!blob)throw Error('fixture-error');
  return new Uint8Array(await blob.arrayBuffer());
}
