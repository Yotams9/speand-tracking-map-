// Offline build freeze only. No credentials, session reservation or provider calls.
import {writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {hashTree,sourceRoots} from './preparation.mjs'
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)))
try{
 if(process.argv.slice(2).join(' ')!=='--freeze-built-app')throw Error()
 const freeze={version:1,build:'.next',source:await hashTree(root,sourceRoots),built:await hashTree(root,['.next'])}
 await mkdir(join(root,'artifacts'),{recursive:true})
 await writeFile(join(root,'artifacts','address-search-prepared.json'),JSON.stringify(freeze),{flag:'wx',mode:0o600})
 console.log(JSON.stringify({prepared:true,providerRequests:0}))
}catch{console.error(JSON.stringify({code:'preparation-failed',providerRequests:0}));process.exitCode=1}
