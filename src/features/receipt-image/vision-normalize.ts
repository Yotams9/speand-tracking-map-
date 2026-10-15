import { validateOcrDocument, type OcrDocument, type OcrWord } from './ocr-parser'
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const list = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new Error('normalization-failed'); return v }
function box(value: unknown) {
  if (!record(value)) throw new Error('normalization-failed')
  const points = list(value.vertices, 4)
  if (points.length !== 4) throw new Error('normalization-failed')
  const xy = points.map(p => {
    if (!record(p)) throw new Error('normalization-failed')
    // REST deliberately omits zero coordinates. Nonzero missing coordinates
    // are not inferred; absent x/y has exactly the documented zero meaning.
    const x = p.x ?? 0, y = p.y ?? 0
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('normalization-failed')
    return { x: x as number, y: y as number }
  })
  const x = Math.min(...xy.map(p => p.x)), y = Math.min(...xy.map(p => p.y))
  return { x, y, width: Math.max(...xy.map(p => p.x)) - x, height: Math.max(...xy.map(p => p.y)) - y }
}
// Full text and provider error messages are never returned or logged. Only
// observed symbols and their geometry enter the transient parser document.
export function normalizeVisionResponse(raw: unknown): OcrDocument {
  if (!record(raw)) throw new Error('normalization-failed')
  const responses = list(raw.responses, 1)
  if (responses.length !== 1 || !record(responses[0]) || responses[0].error) throw new Error('recognition-failed')
  const annotation = responses[0].fullTextAnnotation
  if (!record(annotation)) throw new Error('recognition-empty')
  const pages = list(annotation.pages, 1)
  if (pages.length !== 1 || !record(pages[0])) throw new Error('normalization-failed')
  const page = pages[0], words: OcrWord[] = []
  for (const block of list(page.blocks, 100)) {
    if (!record(block)) throw new Error('normalization-failed')
    for (const paragraph of list(block.paragraphs, 100)) {
      if (!record(paragraph)) throw new Error('normalization-failed')
      for (const word of list(paragraph.words, 1500)) {
        if (!record(word)) throw new Error('normalization-failed')
        const symbols = list(word.symbols, 100)
        if (!symbols.length) throw new Error('normalization-failed')
        let text = '', pending: unknown[] = [], segments = 0
        const flush = () => {
          if (!text) return
          const boxes = pending.map(s => box((s as Record<string, unknown>).boundingBox))
          const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y))
          words.push({ text, x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x, height: Math.max(...boxes.map(b => b.y + b.height)) - y })
          text = ''; pending = []; segments++
          if (words.length > 1500) throw new Error('normalization-failed')
        }
        for (const symbol of symbols) {
          if (!record(symbol) || typeof symbol.text !== 'string' || !symbol.text.length || symbol.text.length > 8) throw new Error('normalization-failed')
          const prop = record(symbol.property) ? symbol.property : null
          const br = prop && record(prop.detectedBreak) ? prop.detectedBreak : null
          if (br && !['UNKNOWN','SPACE','SURE_SPACE','EOL_SURE_SPACE','LINE_BREAK'].includes(String(br.type))) throw new Error('normalization-failed') // No inferred hyphen.
          if (br?.isPrefix) flush()
          text += symbol.text; pending.push(symbol)
          if (br && br.type !== 'UNKNOWN' && !br.isPrefix) flush()
        }
        // For ordinary words, use the observed enclosing word box, preserving
        // rotation bounds. A break inside a word uses the observed symbol boxes.
        if (!segments && text) { words.push({ text, ...box(word.boundingBox) }); if (words.length > 1500) throw new Error('normalization-failed') }
        else flush()
      }
    }
  }
  const result = { version: 1 as const, width: page.width as number, height: page.height as number, words }
  if (!validateOcrDocument(result) || !words.length) throw new Error('normalization-failed')
  return result
}
