import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('assets.json',root),'utf8'));
const allow=new Map(['/index.html','/harness.mjs','/session.mjs','/fixtures.mjs','/worker-bootstrap.js'].map(path=>[path,new URL('.'+path,root)]));
const transfers=[];
for(const asset of manifest.runtime) {
  const url=new URL(asset.file,root), bytes=await readFile(url);
  if(bytes.length!==asset.bytes || createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('asset-integrity');
  allow.set(asset.url,url);
}
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&path==='/__metrics'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(transfers));return;}
  if(req.method==='GET'&&path==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=allow.get(path==='/'?'/index.html':path);
  if(!['GET','HEAD'].includes(req.method)||!file){res.writeHead(404);res.end();return;}
  try {
    const body=await readFile(file), ext=fileURLToPath(file).split('.').pop();
    const socket=res.socket, before=socket.bytesWritten;
    res.on('finish',()=>transfers.push({path,bodyBytes:req.method==='HEAD'?0:body.length,wireBytes:socket.bytesWritten-before}));
    res.writeHead(200,{'Content-Type':ext==='html'?'text/html; charset=utf-8':ext==='js'||ext==='mjs'?'text/javascript; charset=utf-8':'application/octet-stream',
      'Cache-Control':path.startsWith('/vendor/')||path.startsWith('/api/')?'public, max-age=3600':'no-store',
      'Content-Length':body.length,'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob:; style-src 'self'; base-uri 'none'; form-action 'none'"});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(500);res.end('asset-error');}
}).listen(4317,'127.0.0.1',()=>console.log('D1 benchmark listening on loopback port 4317'));
