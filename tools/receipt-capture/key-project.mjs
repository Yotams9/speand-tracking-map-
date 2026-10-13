import {createHash,timingSafeEqual} from 'node:crypto';
const projectNumber='376401338717';
const base='https://apikeys.googleapis.com/v2/';
async function boundedJson(response,signal) {
  if(!response.ok){await response.body?.cancel();throw Error('key-project-unverified');}
  const reader=response.body?.getReader();if(!reader)throw Error('key-project-unverified');
  let body='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try {while(true){if(signal.aborted)throw Error('key-project-unverified');const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>65536){await reader.cancel();throw Error('key-project-unverified');}body+=decoder.decode(r.value,{stream:true});}body+=decoder.decode();return JSON.parse(body);}
  finally{signal.removeEventListener('abort',abort);reader.releaseLock();body='';}
}
// Pure injected read-only transport. No credential access or native transport.
// Key values occur only in temporary response/compare buffers, never a URL.
export async function verifyProjectKey(enteredKey,token,send,signal) {
  if(!/^[A-Za-z0-9_.-]{20,200}$/.test(enteredKey)||!token||signal.aborted)throw Error('key-project-unverified');
  let returnedKey='';let a,b;
  const options={method:'GET',headers:{Authorization:`Bearer ${token}`},redirect:'error',cache:'no-store',signal};
  try {
    const metadata=await boundedJson(await send(`${base}projects/${projectNumber}/locations/global/keys?pageSize=100`,options),signal);
    if(metadata.nextPageToken||!Array.isArray(metadata.keys))throw Error('key-project-unverified');
    const rows=metadata.keys.filter(k=>k?.displayName==='spendscape-benchmark'&&!k.deleteTime);
    if(rows.length!==1||!/^projects\/376401338717\/locations\/global\/keys\/[a-zA-Z0-9_-]{1,128}$/.test(rows[0].name))throw Error('key-project-unverified');
    const value=await boundedJson(await send(`${base}${rows[0].name}/keyString`,options),signal);
    returnedKey=value.keyString;value.keyString='';
    if(typeof returnedKey!=='string'||signal.aborted)throw Error('key-project-unverified');
    a=Buffer.from(enteredKey);b=Buffer.from(returnedKey);
    if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('key-project-unverified');
    return {projectNumber,keyMatch:true,digest:createHash('sha256').update(a).digest('hex')};
  }catch{throw Error('key-project-unverified');}
  finally {returnedKey='';a?.fill(0);b?.fill(0);options.headers.Authorization='';}
}
