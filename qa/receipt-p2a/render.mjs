// Offline synthetic fixture authoring; no app, server, OCR or provider is started.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fixtures } from './fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({offline:true});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  const manifest=[];
  mkdirSync('qa/receipt-p2a/images',{recursive:true});
  for(const f of fixtures) {
    const image=await page.evaluate(f=>{
      const c=document.createElement('canvas');c.width=1200;c.height=320+f.lines.length*62;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
      x.fillStyle=f.transform?'#777':'#111';x.textBaseline='middle';
      if(f.transform){x.translate(18,0);x.transform(1,0.012,-0.012,1,0,0);}
      const draw=(t,px,y,size=22,rtl=false)=>{x.font=`${size}px Arial`;x.direction=rtl?'rtl':'ltr';x.textAlign=rtl?'right':'left';x.fillText(t,px,y);};
      draw('SYNTHETIC — NOT A REAL RECEIPT / קבלה בדיונית',70,35,26);
      draw(f.merchant,70,75,28);draw(`${f.date}     ${f.currency}     DEMO ONLY`,70,112);
      draw('No.',25,155);draw('Item / פריט',150,155);draw('Qty',590,155);draw('Unit',700,155);draw('Price',800,155);draw('Discount',930,155);draw('Amount',1060,155);
      const money=v=>(v/100).toFixed(2);
      f.lines.forEach((l,i)=>{
        const y=200+i*62;draw(String(l.row).padStart(2,'0'),25,y);
        draw(l.label??'▧▧▧▧',560,y,25,true);
        draw(String(l.quantityMilli/1000),590,y);draw(l.unit,700,y);
        draw(money(l.unitMinor),800,y);draw(money(l.discountMinor),930,y);draw(money(l.lineMinor),1060,y);
        x.strokeStyle='#ddd';x.beginPath();x.moveTo(25,y+27);x.lineTo(1160,y+27);x.stroke();
      });
      draw(`TOTAL ILS ${money(f.totalMinor)}`,70,c.height-75,32);
      draw('Prices include tax. Discounts are per row. Fictional benchmark.',70,c.height-32,22);
      return c.toDataURL('image/png').split(',')[1];
    },f);
    const bytes=Buffer.from(image,'base64');
    const path=`qa/receipt-p2a/images/${f.id}.png`;writeFileSync(path,bytes);
    manifest.push({id:f.id,path,width:1200,height:320+f.lines.length*62,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),groundTruth:f});
  }
  writeFileSync('qa/receipt-p2a/manifest.json',JSON.stringify({version:1,synthetic:true,renderer:'offline Chrome canvas / Arial; generated from fixtures.mjs',fixtures:manifest},null,2)+'\n');
  console.log('Rendered 4 synthetic images and exact ground truth; all browser network blocked.');
} finally {await browser.close();}
