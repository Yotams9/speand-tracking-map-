import 'server-only'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createDirectHandler} from '../features/receipt-image/direct-image-boundary'
import {fictionalStructured, structuredEnvelope, structuredResponse} from '../features/receipt-image/structured-image-contract'
import {directPilot, DIRECT_IMAGES} from './direct-image-pilot'

// Offline preparation only. No native transport, key read or live namespace.
export function createStructuredQaHandler(env: Record<string, string | undefined>) {
  const run = env.SPENDSCAPE_STRUCTURED_QA_RUN ?? ''
  const enabled = env.SPENDSCAPE_STRUCTURED_QA === '1' && /^[a-z0-9_-]{8,64}$/.test(run) && !env.VERCEL && !env.CI
  const pilot = directPilot(join(tmpdir(), 'spendscape-structured-mock-' + (enabled ? run : 'disabled')), 0)
  return createDirectHandler({enabled, fictionalQa: true, hash: () => 'fictional-intake',
    slot: async (_hash, request) => pilot.slot(DIRECT_IMAGES[request.headers.get('x-spendscape-direct-fixture') === 'fifteen' ? 1 : 0]),
    status: pilot.status,
    recognize: async (_bytes, _mime, signal, _emit, request) => {
      if (signal.aborted) throw new Error('cancelled')
      // Lifecycle intentionally contains no authentication/dispatch/provider event.
      const raw = structuredEnvelope(fictionalStructured(request.headers.get('x-spendscape-direct-fixture') === 'fifteen' ? 'fifteen' : 'one'))
      return raw
    },
  }, undefined, structuredResponse)
}
export const handleReceiptStructured = createStructuredQaHandler(process.env)
