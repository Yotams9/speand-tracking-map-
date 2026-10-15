import {createHash} from 'node:crypto';
import {readdir,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
export const project='spendscape-receipt-benchmark',projectNumber='376401338717';
export const requestMicroUsd=35400,sessionMs=7200000;
export async function hashTree(root,folders) {
 const files={};
 async function visit(relative) {
  const value=await lstat(join(root,relative));
  if(value.isSymbolicLink())throw Error('build-unverified');
  if(value.isDirectory()){for(const entry of await readdir(join(root,relative),{withFileTypes:true})){if(['cache','node_modules'].includes(entry.name))continue;await visit(join(relative,entry.name));}}
  else files[relative]=createHash('sha256').update(await readFile(join(root,relative))).digest('hex');
 }
 for(const folder of folders)await visit(folder);
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
export function launchOptions(args,now=Date.now()) {
 if(now<Date.parse('2026-10-11T00:00:00Z')||now>=Date.parse('2027-01-01T00:00:00Z'))throw Error('pricing-review-required');
 if(args.length!==5||!args.includes('--provider-session-approved')||!args.includes('--prepay-ready-confirmed')||!args.includes('--auto-reload-off-confirmed'))throw Error('approval-required');
 const count=args.find(a=>/^--requests=([1-9]|10)$/.test(a));
 const cost=args.find(a=>/^--ceiling-usd=0\.[0-9]{2}$/.test(a));
 if(!count||!cost)throw Error('limits-invalid');
 const maxRequests=Number(count.split('=')[1]),ceilingMicroUsd=Math.round(Number(cost.split('=')[1])*1e6);
 if(ceilingMicroUsd>500000||maxRequests*requestMicroUsd>ceilingMicroUsd)throw Error('limits-invalid');
 return {maxRequests,ceilingMicroUsd};
}
export const sourceRoots=['src','public','tools/receipt-capture','package.json','package-lock.json','next.config.ts','tsconfig.json','next-env.d.ts'];
export async function verifyPreparation(root,freeze) {
 if(!freeze||freeze.version!==1||freeze.model!=='gemini-3.8-flash'||freeze.build!=='.next'||!freeze.source||!freeze.built)throw Error('build-unverified');
 if(JSON.stringify(await hashTree(root,sourceRoots))!==JSON.stringify(freeze.source)||JSON.stringify(await hashTree(root,['.next']))!==JSON.stringify(freeze.built))throw Error('build-unverified');
 return true;
}
