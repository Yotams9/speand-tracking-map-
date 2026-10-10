// Usage: node tools/receipt-benchmark/run.mjs [folder] [baseUrl]
// Posts each image in the git-ignored folder (default tools/receipt-benchmark/local-receipts)
// to a running dev server and prints only counts and validation status, never receipt contents.
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const folder = process.argv[2] ?? 'tools/receipt-benchmark/local-receipts'
const baseUrl = process.argv[3] ?? 'http://localhost:3000'
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' }

const files = (await readdir(folder)).filter(name => types[extname(name).toLowerCase()]).sort()
if (files.length === 0) {
  console.error(`No images in ${folder}`)
  process.exit(1)
}

let validated = 0
for (const [index, name] of files.entries()) {
  const bytes = await readFile(join(folder, name))
  const form = new FormData()
  form.set('image', new Blob([bytes], { type: types[extname(name).toLowerCase()] }), name)
  const started = Date.now()
  try {
    const response = await fetch(`${baseUrl}/api/receipt/extract`, { method: 'POST', body: form })
    const body = await response.json()
    if (!response.ok) {
      console.log(`#${index + 1} HTTP ${response.status} ${body.error ?? ''}`)
      continue
    }
    const { extraction, validation } = body
    if (validation.ok) validated++
    const codes = [...new Set(validation.issues.map(issue => issue.code))].join(',') || '-'
    console.log(`#${index + 1} lines=${extraction.lines.length} discounts=${extraction.discounts.length} total_valid=${validation.ok ? 'YES' : 'NO'} issues=${codes} sum_diff_agorot=${validation.sums.printedTotal === null ? 'n/a' : validation.sums.printedTotal - validation.sums.expectedTotal} ${Date.now() - started}ms`)
  } catch (error) {
    console.log(`#${index + 1} request failed: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}
console.log(`\n${validated}/${files.length} receipts validated`)
