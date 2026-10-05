import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
// Only run against the explicit fictional server adapter and a fresh artifact root.
const out=process.env.SPENDSCAPE_VISION_DIAGNOSTIC_QA_DIR!
const headers={'x-spendscape-local-vision':'1','x-spendscape-vision-status':'1'}
test.skip(!out || !out.startsWith(join(process.cwd(),'artifacts','vision-diagnostics-qa')+'/'), 'Requires explicitly configured fictional diagnostics server and isolated QA directory')
test.describe.configure({mode:'serial'})
test('fictional production Capture persists safe server lifecycle independently of browser inspection',async({page})=>{
 await page.setViewportSize({width:360,height:640});await page.goto('/?receiptVisionLocal=1')
 await expect(page.locator('main')).toHaveAttribute('data-local-state','ready')
 await page.getByTestId('capture-open-mobile').click();await page.getByTestId('capture-sources-open').click();await page.getByTestId('capture-source-receipt-image').click()
 await expect(page.locator('#capture-description')).toContainText('One local validation')
 expect(await page.evaluate(async headers=>(await fetch('/api/receipt-ocr',{headers})).json(),headers)).toMatchObject({mode:'fictional-qa',consumed:false})
 await page.getByTestId('receipt-upload-input').setInputFiles(join(out,'synthetic.png'))
 await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','ready');await page.getByTestId('receipt-image-read').click()
 await expect(page.getByTestId('receipt-observations')).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>(window as any).__SPENDSCAPE_QA__)).toMatchObject({combinedPurchaseCount:42,canonicalPins:12,mapInstanceCount:1,mapConstructionCount:1})
 await page.screenshot({path:join(out,'fictional-review.png')})
 // No browser response inspector is used to establish this persisted status.
 await page.goto('/')
 const status=await page.evaluate(async headers=>(await fetch('/api/receipt-ocr',{headers,cache:'no-store'})).json(),headers)
 expect(status).toMatchObject({code:'attempt-status',consumed:true,attempt:{state:'complete'}})
 expect(status.attempt.events.map((e:any)=>e.stage)).toContain('dispatch-initiated')
 expect(status.attempt.events).toContainEqual(expect.objectContaining({stage:'provider-http',httpStatus:200}))
 const text=await readFile(join(out,'attempt-one.lifecycle.jsonl'),'utf8');expect(text).not.toContain('FICTIONAL_TOKEN');expect(text).not.toContain('מוצר');expect(text).not.toContain('raw text')
})
test('consumed status survives reload, repeat POST cannot dispatch, local restrictions remain',async({page,request})=>{
 await page.goto('/');await page.reload()
 expect(await page.evaluate(async headers=>(await fetch('/api/receipt-ocr',{headers})).json(),headers)).toMatchObject({consumed:true,attempt:{state:'complete'}})
 const before=await readFile(join(out,'attempt-one.lifecycle.jsonl'),'utf8')
 const blocked=await request.post('/api/receipt-ocr',{headers:{...headers,origin:'http://127.0.0.1:3000','content-type':'image/png'},data:await readFile(join(out,'synthetic.png'))})
 expect(blocked.status()).toBe(409);expect(await readFile(join(out,'attempt-one.lifecycle.jsonl'),'utf8')).toBe(before)
 const foreign=await request.get('/api/receipt-ocr',{headers:{...headers,origin:'https://example.com'}});expect(foreign.status()).toBe(503)
})
