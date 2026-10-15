// User-run after separate live activation approval, or --offline with no providers.
import {readFile,stat,mkdir,open} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
import {launchOptions,verifyPreparation,serverEnvironment} from './preparation.mjs'
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)))
let child,key='',stopped=false
const stop=()=>{stopped=true;child?.kill('SIGTERM')};process.on('SIGINT',stop);process.on('SIGTERM',stop)
try{
 const options=launchOptions(process.argv.slice(2))
 if(process.env.VERCEL||process.env.CI)throw Error('approval-required')
 await verifyPreparation(root,JSON.parse(await readFile(join(root,'artifacts','address-search-prepared.json'),'utf8')))
 for(const name of ['.env','.env.local','.env.production','.env.production.local'])try{await stat(join(root,name));throw Error('environment-unverified')}catch(e){if(e.code!=='ENOENT')throw e}
 await new Promise((done,reject)=>{const s=createServer();s.once('error',()=>reject(Error('origin-in-use')));s.listen(3172,'127.0.0.1',()=>s.close(done))})
 key=options.offline?'':process.env.GEOAPIFY_API_KEY??''
 const id=options.offline?'':randomBytes(16).toString('hex'),env=serverEnvironment(process.env,key,id)
 delete process.env.GEOAPIFY_API_KEY
 if(stopped)throw Error('server-stopped')
 if(!options.offline){
  const at=Date.now(),directory=join(root,'artifacts','address-search-sessions',id)
  await mkdir(directory,{recursive:true,mode:0o700});const f=await open(join(directory,'session.json'),'wx',0o600)
  try{await f.writeFile(JSON.stringify({version:1,maxRequests:options.maxRequests,createdAt:at,expiresAt:at+options.durationMs}));await f.sync()}finally{await f.close()}
  const d=await open(directory,'r');try{await d.sync()}finally{await d.close()}
 }
 // No unrestricted framework output, inherited provider/debug/proxy flags or key files.
 child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3172'],{cwd:root,env,stdio:['ignore','ignore','ignore']})
 env.GEOAPIFY_API_KEY='';key=''
 console.log(JSON.stringify({mode:options.offline?'providers-disabled':'address-session',maxRequests:options.maxRequests??0,expiresMinutes:options.durationMs?options.durationMs/60_000:0,providerRequests:0}))
 console.log('Local app: http://127.0.0.1:3172/ — only submit a reviewed address after approval; only you confirm and save a place.')
 const code=await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',done)})
 if(code!==0&&!stopped)throw Error('server-stopped')
}catch(e){const codes=['approval-required','limits-invalid','build-unverified','environment-unverified','origin-in-use','private-key-unavailable','server-stopped'];console.error(JSON.stringify({status:'stopped',code:codes.includes(e?.message)?e.message:'preflight-failed'}));process.exitCode=1}
finally{key='';delete process.env.GEOAPIFY_API_KEY;stop()}
