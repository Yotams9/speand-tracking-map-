// Versioned pure projector. No transport, credentials, provider-message matching
// or receipt inspection. Paths are generated from fixed request/schema names,
// never from a provider's arbitrary properties or values.
export const GEMINI_ERROR_BYTES = 16_384
const schemaRoot = 'generationConfig.responseFormat.text.schema'
const paths = [
  'model', 'contents', 'contents[0]', 'contents[0].role', 'contents[0].parts',
  'contents[0].parts[0]', 'contents[0].parts[0].text', 'contents[0].parts[1]',
  'contents[0].parts[1].inlineData', 'contents[0].parts[1].inlineData.mimeType',
  'contents[0].parts[1].inlineData.data', 'generationConfig',
  'generationConfig.maxOutputTokens', 'generationConfig.responseFormat',
  'generationConfig.responseFormat.text', 'generationConfig.responseFormat.text.mimeType',
  schemaRoot,
]
function objectPaths(root: string, requiredCount: number) {
  paths.push(...['type', 'properties', 'required', 'additionalProperties'].map(key => `${root}.${key}`))
  for (let i = 0; i < requiredCount; i++) paths.push(`${root}.required[${i}]`)
}
function nullablePaths(root: string) {
  paths.push(root, `${root}.anyOf`)
  for (const i of [0, 1]) paths.push(`${root}.anyOf[${i}]`, `${root}.anyOf[${i}].type`)
}
objectPaths(schemaRoot, 7)
for (const field of ['merchantName', 'address', 'date', 'time', 'currency', 'finalAmount', 'preVat', 'vatAmount', 'vatRate']) nullablePaths(`${schemaRoot}.properties.${field}`)
const lines = `${schemaRoot}.properties.lines`
paths.push(lines, `${lines}.type`, `${lines}.maxItems`, `${lines}.items`)
objectPaths(`${lines}.items`, 5)
for (const field of ['name', 'quantity', 'unit', 'unitPrice', 'lineAmount', 'discount', 'printedIdentifier']) nullablePaths(`${lines}.items.properties.${field}`)
export const geminiErrorFieldPaths: readonly string[] = Object.freeze([...new Set(paths)])
const canonicalPaths = new Set(geminiErrorFieldPaths)
const aliases = new Map<string, string>()
for (const path of geminiErrorFieldPaths) {
  aliases.set(path, path)
  // Proto/JSON field spellings are aliases only in an error path. The actual
  // schema property names are literal keys and must not be converted.
  const [request, schema] = path.split('.schema')
  aliases.set(request.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`) + (schema === undefined ? '' : `.schema${schema}`), path)
}
const captures = ['parsed', 'malformed', 'oversized'] as const
const reasons = ['structured-field-violation', 'no-safe-field-detail', 'malformed-error', 'oversized-error'] as const
export interface GeminiErrorDiagnostic {
  version: 1
  capture: typeof captures[number]
  rejectedField: 'provided' | 'rejected field unknown'
  fields: string[]
  reason: typeof reasons[number]
  truncated: boolean
}
const dataProperties = (v: object) => Reflect.ownKeys(v).every(key => typeof key === 'string' && 'value' in Object.getOwnPropertyDescriptor(v, key)!)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v)) && dataProperties(v)
const array = (v: unknown): v is unknown[] => Array.isArray(v) && dataProperties(v) &&
  Reflect.ownKeys(v).length === v.length + 1 && Object.keys(v).length === v.length &&
  Object.keys(v).every(key => /^(0|[1-9]\d*)$/.test(key) && Number(key) < v.length)
export function unknownGeminiError(capture: GeminiErrorDiagnostic['capture'] = 'parsed'): GeminiErrorDiagnostic {
  return { version: 1, capture, rejectedField: 'rejected field unknown', fields: [],
    reason: capture === 'malformed' ? 'malformed-error' : capture === 'oversized' ? 'oversized-error' : 'no-safe-field-detail', truncated: false }
}
export function projectGeminiError(raw: unknown): GeminiErrorDiagnostic {
  if (!object(raw) || !object(raw.error)) return unknownGeminiError('malformed')
  const result = unknownGeminiError()
  const details = raw.error.details
  if (!array(details)) return result
  result.truncated = details.length > 8
  let inspected = 0
  for (const detail of details.slice(0, 8)) {
    if (!object(detail) || detail['@type'] !== 'type.googleapis.com/google.rpc.BadRequest') continue
    // Canonical JSON spelling only; no untyped arbitrary field lists.
    if (!array(detail.fieldViolations)) continue
    for (const violation of detail.fieldViolations) {
      if (inspected++ >= 32) { result.truncated = true; break }
      if (!object(violation) || typeof violation.field !== 'string' || violation.field.length > 256) continue
      const path = aliases.get(violation.field)
      if (!path || result.fields.includes(path)) continue
      if (result.fields.length === 8) { result.truncated = true; continue }
      result.fields.push(path)
    }
  }
  if (result.fields.length) {
    result.rejectedField = 'provided'
    result.reason = 'structured-field-violation'
  }
  return result
}
// Durable journal revalidation must reject extra keys, mutated paths and
// internally inconsistent categories; it must never silently launder content.
export function validGeminiErrorDiagnostic(raw: unknown): raw is GeminiErrorDiagnostic {
  if (!object(raw) || Reflect.ownKeys(raw).length !== 6 ||
    !Object.keys(raw).every(key => ['version', 'capture', 'rejectedField', 'fields', 'reason', 'truncated'].includes(key)) ||
    raw.version !== 1 || !captures.includes(raw.capture as typeof captures[number]) ||
    !reasons.includes(raw.reason as typeof reasons[number]) || typeof raw.truncated !== 'boolean' ||
    !array(raw.fields) || raw.fields.length > 8 || new Set(raw.fields).size !== raw.fields.length ||
    !raw.fields.every(field => typeof field === 'string' && canonicalPaths.has(field))) return false
  if (raw.fields.length) return raw.capture === 'parsed' && raw.rejectedField === 'provided' && raw.reason === 'structured-field-violation'
  const expected = unknownGeminiError(raw.capture as GeminiErrorDiagnostic['capture'])
  return raw.rejectedField === expected.rejectedField && raw.reason === expected.reason && (raw.capture === 'parsed' || raw.truncated === false)
}
