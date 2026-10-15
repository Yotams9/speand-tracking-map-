// User execution only. Starts loopback Capture; never dispatches search itself.
import {readFile,stat} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {approvedArguments,checkPreparation,serverEnvironment,BUILD} from './preflight.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),exec=promisify(execFile);
let key='',child;
const stop=()=>child?.kill('SIGTERM');process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 if(!approvedArguments(process.argv.slice(2))||process.env.VERCEL||process.env.CI)throw Error('approval-required');
 const bytes=await readFile(join(root,'qa/address-search-native/freeze.json'));
 const result=await checkPreparation(JSON.parse(bytes),{
  read:path=>readFile(join(root,path)),
  exists:async path=>{try{await stat(join(root,path));return true}catch(e){if(e.code==='ENOENT')return false;throw Error('preflight-failed')}},
  git:async(...args)=>(await exec('git',args,{cwd:root,maxBuffer:65536})).stdout.trim(),
 });
 key=process.env.GEOAPIFY_API_KEY??'';
 const env=serverEnvironment(key,createHash('sha256').update(bytes).digest('hex'),process.env);
 delete process.env.GEOAPIFY_API_KEY;
 // Inherit no scanner/provider/debug/proxy environment. Suppress framework logs:
 // they are unnecessary for this bounded run and could expose unrestricted errors.
 child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3172'],{cwd:join(root,BUILD),env,stdio:['ignore','ignore','ignore']});
 env.GEOAPIFY_API_KEY='';key='';
 console.log(JSON.stringify(result));
 console.log('Location review: http://127.0.0.1:3172 — review address; Search once; candidate proposes only; only you confirm and save place. Local status: /api/address-search.');
 const exit=await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',code=>done(code));});
 if(exit!==0)throw Error('server-stopped');
}catch(error){
 const codes=['approval-required','attempt-consumed','git-unverified','freeze-unverified','private-key-unavailable','server-stopped'];
 console.error(JSON.stringify({status:'stopped',code:codes.includes(error?.message)?error.message:'preflight-failed'}));process.exitCode=1;
}finally{key='';delete process.env.GEOAPIFY_API_KEY;stop();}
