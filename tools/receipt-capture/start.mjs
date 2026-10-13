// User-run only after separate provider/session authorization. One startup,
// repeated explicit Capture reads. No inference occurs in this launcher.
import {readFile,mkdir,open,stat} from 'node:fs/promises';import {createHash,randomBytes} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyProjectKey} from './key-project.mjs';
import {launchOptions,verifyPreparation,project,projectNumber,requestMicroUsd,sessionMs} from './preparation.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),exec=promisify(execFile);
let key='',token='',child;const controller=new AbortController();
const stop=()=>{controller.abort();child?.kill('SIGTERM')};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try {
 const limits=launchOptions(process.argv.slice(2));
 if(process.env.VERCEL||process.env.CI||process.env.GOOGLE_API_KEY)throw Error('approval-required');
 const freeze=JSON.parse(await readFile(join(root,'artifacts','receipt-capture-prepared.json'),'utf8'));
 await verifyPreparation(root,freeze);
 // Check the origin is free before any private authentication activity.
 const net=await import('node:net');await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error('origin-in-use')));s.listen(3172,'127.0.0.1',()=>s.close(resolve))});
 // No inherited activation or provider key. .env files are forbidden in this
 // prepared launch root to avoid Next loading unrelated historical flags.
 for(const name of ['.env','.env.local','.env.production','.env.production.local'])try{await stat(join(root,name));throw Error('environment-unverified')}catch(e){if(e.code!=='ENOENT')throw e}
 key=process.env.GEMINI_API_KEY??'';if(!/^[A-Za-z0-9_.-]{20,200}$/.test(key))throw Error('key-project-unverified');
 const authEnv={...process.env,CLOUDSDK_CORE_LOG_HTTP:'false',CLOUDSDK_CORE_VERBOSITY:'none'};
 for(const k of ['GEMINI_API_KEY','GOOGLE_API_KEY','GROQ_API_KEY','NODE_DEBUG','NODE_OPTIONS'])delete authEnv[k];
 const result=await exec('gcloud',['auth','print-access-token','--quiet','--verbosity=none'],{env:authEnv,timeout:15000,maxBuffer:65536,signal:controller.signal});token=result.stdout.trim();result.stdout='';result.stderr='';
 const verification=await verifyProjectKey(key,token,(url,options)=>fetch(url,options),AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));token='';
 const contract=await readFile(join(root,'src/features/receipt-image/structured-image-contract.ts'),'utf8');
 const prompt=contract.match(/export const STRUCTURED_PROMPT = `([\s\S]*?)`/)[1];
 const contractHash=createHash('sha256').update('gemini-3.8-flash'+prompt+'|4096|application/json').digest('hex');
 const session=randomBytes(16).toString('hex'),directory=join(root,'artifacts','receipt-capture-sessions',session),createdAt=Date.now();
 if(controller.signal.aborted)throw Error('preflight-failed');
 await mkdir(directory,{recursive:true,mode:0o700});const f=await open(join(directory,'session.json'),'wx',0o600);
 try{await f.writeFile(JSON.stringify({version:1,model:'gemini-3.8-flash',contractHash,...limits,createdAt,expiresAt:createdAt+sessionMs}));await f.sync()}finally{await f.close()}
 const d=await open(directory,'r');try{await d.sync()}finally{await d.close()}
 const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('SPENDSCAPE_')||['GOOGLE_API_KEY','GROQ_API_KEY','GEMINI_API_KEY','NODE_DEBUG','NODE_OPTIONS'].includes(k))delete env[k];
 Object.assign(env,{NEXT_TELEMETRY_DISABLED:'1',SPENDSCAPE_RECEIPT_CAPTURE:'native',SPENDSCAPE_RECEIPT_SESSION:session,SPENDSCAPE_RECEIPT_PROJECT:project,SPENDSCAPE_RECEIPT_PROJECT_NUMBER:projectNumber,SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256:verification.digest,SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED:'1',GEMINI_API_KEY:key});
 child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3172'],{cwd:root,env,stdio:'inherit'});env.GEMINI_API_KEY='';key='';delete process.env.GEMINI_API_KEY;
 console.log(JSON.stringify({keyMatch:true,projectNumber,maxRequests:limits.maxRequests,estimatedMaximumUsd:limits.maxRequests*requestMicroUsd/1e6,ceilingUsd:limits.ceilingMicroUsd/1e6,inferenceRequests:0}));
 console.log('Capture: http://127.0.0.1:3172/ — explicit Read; one minute between images; review before your explicit Save.');
 await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',done)});
}catch(e){const codes=['approval-required','pricing-review-required','limits-invalid','build-unverified','origin-in-use','key-project-unverified','environment-unverified'];console.error(JSON.stringify({status:'stopped',code:codes.includes(e?.message)?e.message:'preflight-failed',inferenceRequests:0}));process.exitCode=1}
finally{token='';key='';delete process.env.GEMINI_API_KEY;stop()}
