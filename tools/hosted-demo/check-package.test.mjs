import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {checkTraces} from './check-package.mjs'
function fixture(files,work){const r=mkdtempSync(join(tmpdir(),'spendscape-trace-'));try{mkdirSync(join(r,'.next/server'),{recursive:true});writeFileSync(join(r,'.next/server/route.nft.json'),JSON.stringify({files}));work(r)}finally{rmSync(r,{recursive:true,force:true})}}
test('runtime catalog and dependency paths accepted',()=>fixture(['../../data/catalog/tel-aviv.json','../../node_modules/next/package.json'],r=>assert.equal(checkTraces(r).forbidden,0)))
test('local evidence, credentials, configuration and escaped paths rejected',()=>fixture(['../../artifacts/private.json','../../.env.production.local','../../.vercel/project.json','../../qa/fixture.json','../../../outside-private.json'],r=>{const x=checkTraces(r);assert.equal(x.forbidden,5);assert.ok(!JSON.stringify(x).includes('private.json'))}))
test('malformed traces fail closed',()=>fixture([42],r=>assert.throws(()=>checkTraces(r),/trace-invalid/)))
