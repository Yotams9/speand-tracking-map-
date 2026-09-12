import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('assets.json',root)));
test('exact approved runtime and license manifest matches every byte',()=>{
  for(const asset of [...manifest.runtime,...manifest.licenses]){const bytes=fs.readFileSync(new URL(asset.file,root));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
  for(const asset of manifest.runtime.filter(a=>a.file.startsWith('vendor/core/'))){assert.deepEqual(fs.readFileSync(new URL(asset.file,root)),fs.readFileSync(new URL('../../node_modules/tesseract.js-core/'+asset.file.split('/').pop(),root)));}
  assert.deepEqual(fs.readdirSync(new URL('vendor/core/',root)).sort(),['tesseract-core-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js']);
  for(const [language,expected] of [['eng','bbef4675053b5b468cdb477053e28b1c698ba08e'],['heb','7356caf3cddc9c867fe6727e17726727b8284608']]){
    const bytes=fs.readFileSync(new URL('vendor/lang/'+language+'.traineddata',root));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected);
  }
});
test('exact dependencies and deduplicated public API/core pair; no prior package changes',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../../package.json',root))),lock=JSON.parse(fs.readFileSync(new URL('../../package-lock.json',root))),graph=JSON.parse(fs.readFileSync(new URL('dependencies.json',root)));
  for(const name of ['tesseract.js','tesseract.js-core']){assert.equal(pkg.devDependencies[name],'7.0.0');assert.equal(lock.packages['node_modules/'+name].version,'7.0.0');}
  assert.equal(Object.keys(lock.packages).filter(path=>path.endsWith('/tesseract.js-core')).length,1);assert.deepEqual(graph.existingPackagesChanged,[]);assert.deepEqual(graph.scriptsExecuted,[]);
});
