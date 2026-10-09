import 'server-only'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {createDirectHandler} from '../features/receipt-image/direct-image-boundary'
import {structuredCost, structuredResponse} from '../features/receipt-image/structured-image-contract'
import {createStructuredTransport} from '../features/receipt-image/structured-image-transport'
import {directDiagnosticPilot} from './direct-image-diagnostic'
import {DIRECT_PROJECT, DIRECT_PROJECT_NUMBER, verifiedRecoveryKey} from './direct-image-recovery'

export const STRUCTURED_NATIVE_RUN = 'structured-validation-20261009-one'
export const STRUCTURED_NATIVE_HASH = '1c9420c3fded6fe371c7943c02aece82bf10fadff0e0a68c16e362e6748c833d'
export function structuredNativeReady(env: NodeJS.ProcessEnv, now = new Date()) {
  try { if (structuredCost(now).estimatedUsd > 0.10) return false } catch { return false }
  return env.SPENDSCAPE_STRUCTURED_NATIVE_RUN === STRUCTURED_NATIVE_RUN &&
    env.SPENDSCAPE_STRUCTURED_NATIVE_APPROVED === '1' && env.SPENDSCAPE_STRUCTURED_PREPAY_CONFIRMED === '1' &&
    env.SPENDSCAPE_STRUCTURED_PROJECT === DIRECT_PROJECT && env.SPENDSCAPE_STRUCTURED_PROJECT_NUMBER === DIRECT_PROJECT_NUMBER &&
    /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_STRUCTURED_VERIFIED_KEY_SHA256 ?? '') &&
    !env.SPENDSCAPE_STRUCTURED_QA && !env.VERCEL && !env.CI
}
// Literal fixed roots. No environment path override, old-run reuse or slot two.
export function structuredNativePilot(workspace: string) {
  return directDiagnosticPilot(join(workspace, 'artifacts', 'receipt-gemini-structured-validation-20261009-one'), {
    original: join(workspace, 'artifacts', 'receipt-direct-image-20261008-two'),
    recovery: join(workspace, 'artifacts', 'receipt-direct-image-recovery-20261008-prepay-one'),
  })
}
export function createStructuredNativeHandler(env: NodeJS.ProcessEnv, send: typeof fetch, workspace = process.cwd()) {
  const pilot = structuredNativePilot(workspace)
  const recognize = createStructuredTransport(() => verifiedRecoveryKey(env.GEMINI_API_KEY ?? '', env.SPENDSCAPE_STRUCTURED_VERIFIED_KEY_SHA256), send, STRUCTURED_NATIVE_HASH)
  return createDirectHandler({enabled: structuredNativeReady(env), fictionalQa: false,
    hash: bytes => createHash('sha256').update(bytes).digest('hex'), slot: hash => pilot.slot(hash), status: pilot.status,
    recognize,
  }, undefined, structuredResponse)
}
export const handleReceiptStructuredNative = createStructuredNativeHandler(process.env, (url, options) => fetch(url, options))
