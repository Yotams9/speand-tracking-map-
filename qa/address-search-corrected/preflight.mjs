import {createHash} from 'node:crypto';
export const ROOT='/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree';
export const RUN='geoapify-corrected-address-validation-20261011-one';
export const HEAD='b7ce7f8615c2162eec4817729aac31595c90afda';
export const BUILD='artifacts/geoapify-corrected-20261011/app';
export const RECORD=`artifacts/${RUN}`;
const hash=b=>createHash('sha256').update(b).digest('hex');
export const flags=['--one-search','--key-project-confirmed','--free-plan-confirmed','--remaining-credit-confirmed','--no-concurrent-use-confirmed','--no-paid-overage-confirmed'];
export function approvedArguments(args){return args.length===flags.length&&flags.every(f=>args.filter(a=>a===f).length===1);}
export async function checkPreparation(f,ports){
 if(f.run!==RUN||f.head!==HEAD||f.build!==BUILD||f.maximumRequests!==1||f.maximumCredits!==1||!Array.isArray(f.files)||f.files.length<1||f.files.length>2500)throw Error('freeze-unverified');
 if(await ports.git('rev-parse','HEAD')!==HEAD||await ports.git('branch','--show-current')!=='feature/spendscape-rebuild'||await ports.git('diff','--cached','--name-only')!=='')throw Error('git-unverified');
 if(await ports.exists(`${RECORD}/reservation.json`))throw Error('attempt-consumed');
 for(const x of f.files){if(!x||typeof x.path!=='string'||!/^[A-Za-z0-9_.\/()[\]@-]+$/.test(x.path)||x.path.split('/').includes('..')||!['src/','package','next.config','tsconfig','qa/address-search-corrected/',`${BUILD}/`].some(p=>x.path.startsWith(p))||!/^\w{64}$/.test(x.sha256)||hash(await ports.read(x.path))!==x.sha256)throw Error('freeze-unverified');}
 return {run:RUN,requests:0,maximumRequests:1,maximumCredits:1,providerCharge:'free-allowance-user-confirmed',keyProject:'user-console-confirmed'};
}
export function serverEnvironment(key,digest,parent){
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(key)||! /^[a-f0-9]{64}$/.test(digest))throw Error('private-key-unavailable');
 const env={NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'};
 for(const k of ['PATH','TMPDIR','TZ','LANG','LC_ALL'])if(parent[k])env[k]=parent[k];
 Object.assign(env,{GEOAPIFY_API_KEY:key,SPENDSCAPE_GEOAPIFY_WORKSPACE:ROOT,SPENDSCAPE_GEOAPIFY_RUN:RUN,SPENDSCAPE_GEOAPIFY_FREEZE_SHA256:digest,SPENDSCAPE_GEOAPIFY_FREE_CONFIRMED:'1',SPENDSCAPE_GEOAPIFY_PROJECT_CONFIRMED:'1',SPENDSCAPE_GEOAPIFY_ALLOWANCE_CONFIRMED:'1',SPENDSCAPE_GEOAPIFY_NO_CONCURRENT_CONFIRMED:'1',SPENDSCAPE_GEOAPIFY_NO_PAID_OVERAGE_CONFIRMED:'1'});
 return env;
}
