import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {hashTree,launchOptions,verifyPreparation,sourceRoots} from './preparation.mjs';import {verifyProjectKey} from './key-project.mjs';
const now=Date.parse('2026-10-11T12:00:00Z'),flags=['--provider-session-approved','--prepay-ready-confirmed','--auto-reload-off-confirmed'];
test('finite count/cost, approval, expiry, no hidden options',()=>{
 assert.deepEqual(launchOptions([...flags,'--requests=2','--ceiling-usd=0.10'],now),{maxRequests:2,ceilingMicroUsd:100000});
 for(const args of [[...flags,'--requests=10','--ceiling-usd=0.10'],[...flags,'--requests=2','--ceiling-usd=0.99'],[...flags,'--requests=0','--ceiling-usd=0.10'],[...flags,'--requests=2','--ceiling-usd=0.10','--retry'],['--requests=2','--ceiling-usd=0.10']])assert.throws(()=>launchOptions(args,now));
 assert.throws(()=>launchOptions([...flags,'--requests=2','--ceiling-usd=0.10'],Date.parse('2027-01-01')));
});
test('freeze complete source and build without ignored history dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'receipt-start-mock-'));
 try {
  for(const file of sourceRoots){const path=join(root,file);if(file.includes('.')){await mkdir(join(path,'..'),{recursive:true});await writeFile(path,'synthetic')}else{await mkdir(path,{recursive:true});await writeFile(join(path,'mock'),'synthetic')}}
  await mkdir(join(root,'.next/server'),{recursive:true});await writeFile(join(root,'.next/server/mock.js'),'synthetic build');
  const freeze={version:1,model:'gemini-3.8-flash',build:'.next',source:await hashTree(root,sourceRoots),built:await hashTree(root,['.next'])};
  assert.equal(await verifyPreparation(root,freeze),true);await writeFile(join(root,'src/new.ts'),'unreviewed');await assert.rejects(verifyPreparation(root,freeze));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('a symlink cannot evade the source freeze',async()=>{
 const root=await mkdtemp(join(tmpdir(),'receipt-freeze-mock-'));
 try{await mkdir(join(root,'src'));await writeFile(join(root,'actual'),'synthetic');await symlink(join(root,'actual'),join(root,'src/hidden.ts'));await assert.rejects(hashTree(root,['src']),/build-unverified/)}finally{await rm(root,{recursive:true,force:true})}
});
test('private exact key/project comparison uses header token, no key in URL; safe mismatch',async()=>{
 const key='synthetic_key_1234567890123';let calls=0;
 const send=async(url,options)=>{calls++;assert.ok(!url.includes(key));assert.equal(options.redirect,'error');return Response.json(calls===1?{keys:[{displayName:'spendscape-benchmark',name:'projects/376401338717/locations/global/keys/synthetic'}]}:{keyString:key})};
 const result=await verifyProjectKey(key,'synthetic_access_token',send,new AbortController().signal);assert.equal(result.keyMatch,true);assert.equal(result.digest,createHash('sha256').update(key).digest('hex'));assert.equal(calls,2);
 await assert.rejects(verifyProjectKey(key,'synthetic_access_token',async()=>Response.json({keys:[]}),new AbortController().signal),/key-project-unverified/);
});
test('launcher is operational only; no historical paths/inference/credential output or permissive overrides',async()=>{
 const source=await readFile(new URL('./start.mjs',import.meta.url),'utf8');assert.ok(!source.includes('generateContent'));assert.ok(!source.includes('receipt-direct-recovery'));assert.ok(!source.includes('console.log(key'));assert.ok(source.includes('origin-in-use'));assert.ok(source.includes("'127.0.0.1'"));
});
