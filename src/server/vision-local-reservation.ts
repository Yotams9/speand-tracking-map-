import { mkdir, open, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
// Exclusive file, fsynced before any credential/transport work. EEXIST and
// uncertain filesystem failure both fail closed. Never remove/reset this file.
export function visionReservation(path: string) {
  return {
    consumed: async () => { try { await stat(path); return true } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return false;return true } },
    reserve: async () => {
      await mkdir(dirname(path),{recursive:true,mode:0o700})
      let file
      try {file=await open(path,'wx',0o600)}catch{throw new Error('attempt-consumed')}
      try {
        await file.writeFile('{"version":1,"attempt":1,"reserved":true,"feature":"DOCUMENT_TEXT_DETECTION","maximumRequests":1}\n')
        await file.sync()
        const directory=await open(dirname(path),'r');try{await directory.sync()}finally{await directory.close()}
      } finally {await file.close()}
    },
  }
}
