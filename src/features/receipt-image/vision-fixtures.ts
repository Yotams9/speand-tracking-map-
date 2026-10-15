import type { OcrDocument, OcrWord } from './ocr-parser'
// Fictional, reference-independent controls for the short printed layout.
// No real receipt values are used in QA fixtures.
export function fictionalShortOcr(count=1):OcrDocument {
  const words:OcrWord[]=[]
  const add=(text:string,x:number,y:number,width=Math.max(text.length*8,20))=>words.push({text,x,y,width,height:20})
  add('בית',650,20);add('בדוי',580,20);add('Imaginary',500,60,72);add('Street',585,60,48);add('8',650,60)
  add('04-10-26',20,100,90);add('10:35',125,100,50)
  add('סה״כ',60,180);add('פריט',490,180);add('תיאור',540,180);add('פריט',835,180);add('קוד',880,180)
  add('כמות',850,215);add('יחידה',525,215);add('מ.',580,215)
  for(let i=0;i<count;i++){const y=260+i*65;add('7.50',60,y,40);add('בדוי',500,y);add('מוצר',550,y);add(String(800000+i),850,y,64);add('2.50',540,y+28,40);add('3',875,y+28)}
  const end=290+count*65;add('מעמ',550,end);add('לפני',600,end);add('סכום',655,end);add('6.00',60,end,40)
  add('מעמ',655,end+35);add('1.50',60,end+35,40)
  add('מעמ',550,end+70);add('כולל',600,end+70);add('סכום',655,end+70);add((count*7.5).toFixed(2),60,end+70,56)
  return {version:1,width:1000,height:Math.max(1000,end+120),words}
}
export function visionResponse(doc:OcrDocument):unknown {
  const poly=(w:OcrWord)=>({vertices:[{x:w.x,y:w.y},{x:w.x+w.width,y:w.y},{x:w.x+w.width,y:w.y+w.height},{x:w.x,y:w.y+w.height}]})
  return {responses:[{fullTextAnnotation:{text:'Synthetic private raw text MUST NOT LEAK',pages:[{width:doc.width,height:doc.height,blocks:[{paragraphs:[{words:doc.words.map(w=>({boundingBox:poly(w),symbols:[...w.text].map((text,i)=>({text,boundingBox:poly({...w,x:Math.round(w.x+i*w.width/[...w.text].length),width:Math.max(1,Math.round(w.width/[...w.text].length))})}))}))}]}]}]}}]}
}
