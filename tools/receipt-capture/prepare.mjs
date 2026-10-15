// Offline only: freezes an already built local application. Never reads a key.
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {resolve,join} from 'node:path';
import {hashTree,sourceRoots} from './preparation.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
if(process.argv.slice(2).join(' ')!=='--freeze-built-app')throw Error('preparation-argument-required');
const freeze={version:1,model:'gemini-3.8-flash',build:'.next',source:await hashTree(root,sourceRoots),built:await hashTree(root,['.next'])};
await mkdir(join(root,'artifacts'),{recursive:true});
await writeFile(join(root,'artifacts','receipt-capture-prepared.json'),JSON.stringify(freeze,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({prepared:true,sourceFiles:Object.keys(freeze.source).length,buildFiles:Object.keys(freeze.built).length,inferenceRequests:0}));
