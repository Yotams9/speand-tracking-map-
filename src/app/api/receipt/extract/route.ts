import { validateReceipt, type ReceiptExtraction } from '@/features/receipt/receipt-domain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
const DEFAULT_MODEL = 'gemini-3.5-flash'

const PROMPT = `You are a transcription tool for a Hebrew supermarket receipt photographed by its owner.
Copy ONLY what is printed on the receipt. Never guess, complete, estimate, correct or infer any value.
- All prices are in shekels as printed (for example 12.90), as plain numbers.
- Each product line: the printed name, the printed barcode if one is printed, the quantity, unit ("kg" for weighed items, otherwise "item"), the printed unit price and the printed line total.
- If a line shows only one price for a single item, unitPrice and lineTotal are both that price and quantity is 1.
- Discount/promotion lines are separate entries in "discounts", with the amount as a NEGATIVE number as printed.
- "total" is the printed amount to pay.
- Omit optional fields that are not printed. purchasedAt is ISO local time YYYY-MM-DDTHH:mm, only if both date and time are printed.
- If the image is not a receipt or is unreadable, return an empty "lines" array and total 0.`

const schema = {
  type: 'object',
  properties: {
    storeName: { type: 'string' },
    chain: { type: 'string' },
    branchName: { type: 'string' },
    purchasedAt: { type: 'string' },
    currency: { type: 'string', description: 'ISO code, ILS for shekels' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          barcode: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: ['item', 'kg'] },
          unitPrice: { type: 'number' },
          lineTotal: { type: 'number' },
        },
        required: ['name', 'quantity', 'unit', 'unitPrice', 'lineTotal'],
      },
    },
    discounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, amount: { type: 'number' } },
        required: ['label', 'amount'],
      },
    },
    total: { type: 'number' },
  },
  required: ['storeName', 'currency', 'lines', 'discounts', 'total'],
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return json({ error: 'receipt-reader-not-configured', message: 'GEMINI_API_KEY is not set on the server.' }, 503)

  let file: File | null = null
  try {
    const form = await request.formData()
    const entry = form.get('image')
    file = entry instanceof File ? entry : null
  } catch {
    return json({ error: 'invalid-request', message: 'Expected multipart/form-data with one "image" file.' }, 400)
  }
  if (!file) return json({ error: 'invalid-request', message: 'Expected multipart/form-data with one "image" file.' }, 400)
  if (file.size === 0 || file.size > MAX_BYTES) return json({ error: 'invalid-image-size', message: 'Image must be between 1 byte and 8 MB.' }, 413)
  const mimeType = file.type.toLowerCase()
  if (!ALLOWED.includes(mimeType)) return json({ error: 'unsupported-type', message: 'Use JPEG, PNG, HEIC or WebP.' }, 415)

  const data = Buffer.from(await file.arrayBuffer()).toString('base64')
  const body = JSON.stringify({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    input: [
      { type: 'text', text: PROMPT },
      { type: 'image', data, mime_type: mimeType },
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema },
  })

  let upstream: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(45_000),
      })
    } catch {
      upstream = null
    }
    if (upstream && upstream.status !== 503 && upstream.status !== 429) break
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
  }
  if (!upstream) return json({ error: 'upstream-unreachable', message: 'The receipt reader could not be reached.' }, 502)
  if (!upstream.ok) return json({ error: 'upstream-error', message: `The receipt reader returned status ${upstream.status}.` }, 502)

  let text: string | undefined
  try {
    const result = await upstream.json() as { steps?: { type?: string; content?: { type?: string; text?: string }[] }[] }
    text = result.steps?.filter(step => step.type === 'model_output').flatMap(step => step.content ?? []).find(part => part.type === 'text')?.text
  } catch {
    text = undefined
  }
  if (!text) return json({ error: 'empty-response', message: 'The receipt reader returned no content.' }, 502)

  let extraction: ReceiptExtraction
  try {
    extraction = JSON.parse(text) as ReceiptExtraction
  } catch {
    return json({ error: 'malformed-response', message: 'The receipt reader returned malformed JSON.' }, 502)
  }
  if (!extraction || typeof extraction !== 'object') return json({ error: 'malformed-response', message: 'The receipt reader returned malformed JSON.' }, 502)
  extraction.lines = Array.isArray(extraction.lines) ? extraction.lines : []
  extraction.discounts = Array.isArray(extraction.discounts) ? extraction.discounts : []

  return json({ extraction, validation: validateReceipt(extraction) }, 200)
}
