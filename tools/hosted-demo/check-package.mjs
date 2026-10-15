// Build privacy guard: inspect dependency paths, never file contents or secrets.
import {readdirSync,readFileSync} from 'node:fs'
import {resolve,relative,join} from 'node:path'
import {pathToFileURL} from 'node:url'
const privateRoots=new Set(['artifacts','qa','tools','docs','.vercel','.git','.agents','.claude','.cache'])
export function checkTraces(root){
 let traces=0,dependencies=0,forbidden=0
 function walk(folder){for(const e of readdirSync(folder,{withFileTypes:true})){
  const p=join(folder,e.name)
  if(e.isDirectory())walk(p)
  else if(e.isFile()&&e.name.endsWith('.nft.json')){
   traces++;const d=JSON.parse(readFileSync(p,'utf8'))
   if(!Array.isArray(d.files)||d.files.length>100000)throw Error('trace-invalid')
   for(const f of d.files){dependencies++;if(typeof f!=='string')throw Error('trace-invalid');const rel=relative(root,resolve(folder,f)).split('\\').join('/'),first=rel.split('/')[0]
    if(rel.startsWith('../')||privateRoots.has(first)||first.startsWith('.env'))forbidden++
   }
  }
 }}
 walk(join(root,'.next'))
 if(!traces)throw Error('trace-missing')
 return {traces,dependencies,forbidden}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const r=checkTraces(process.cwd());console.log(JSON.stringify({status:r.forbidden?'blocked':'clean',...r}));if(r.forbidden)process.exitCode=1}
 catch{console.log(JSON.stringify({status:'blocked',code:'package-unverified'}));process.exitCode=1}
}
