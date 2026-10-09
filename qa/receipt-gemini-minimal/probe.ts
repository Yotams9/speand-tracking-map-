// Offline design only. No transport, credential reader, reservation or save path.
export const PROBE_MODEL = 'gemini-3.8-flash'
export const PROBE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${PROBE_MODEL}:generateContent`
export const PROBE_INSTRUCTION = 'Transcribe the visible text in its original language. Leave unclear text unresolved.'
export const PROBE_OUTPUT_TOKENS = 2048
export const CANDIDATE_SHA256 = 'f309579ac77c22676d778758c1cc909bb33c0e4ab3fb7a65af180c3876360292'

export function minimalProbeRequest(mime: string, base64: string) {
  if (!['image/jpeg', 'image/png'].includes(mime)) throw new Error('image-format')
  if (typeof base64 !== 'string' || !base64.length || base64.length > 5_592_408 ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0) > 4_194_304) {
    throw new Error('image-data')
  }
  // Canonical REST Part/Blob names; text/plain and one candidate are defaults.
  // maxOutputTokens is the sole generation option, retained for a cost bound.
  return {
    contents: [{ parts: [
      { text: PROBE_INSTRUCTION },
      { inlineData: { mimeType: mime, data: base64 } },
    ] }],
    generationConfig: { maxOutputTokens: PROBE_OUTPUT_TOKENS },
  }
}

// Estimate, not an enforced provider dollar limit or exact token count.
// No countTokens/provider request is made. Expiry requires repricing/review.
export function conservativeProbeCost(date: string) {
  const time = Date.parse(date)
  if (!Number.isFinite(time) || time < Date.parse('2026-10-09T00:00:00Z') ||
      time >= Date.parse('2027-01-01T00:00:00Z')) throw new Error('pricing-review-required')
  const textAndOverheadTokens = 1000
  if (new TextEncoder().encode(PROBE_INSTRUCTION).length + 512 > textAndOverheadTokens) {
    throw new Error('input-bound')
  }
  const imageTokens = 2240 // Documented default 1120, reserve ultra-high allocation.
  const generatedTokens = PROBE_OUTPUT_TOKENS * 2 // Extra safety above combined cap.
  const usd = ((textAndOverheadTokens + imageTokens) * 0.75 + generatedTokens * 3.75) / 1_000_000
  if (usd > 0.10) throw new Error('cost-bound')
  return { inputTokens: textAndOverheadTokens + imageTokens, generatedTokens, usd }
}
