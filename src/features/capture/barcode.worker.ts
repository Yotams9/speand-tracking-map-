import { prepareZXingModule, readBarcodes, ZXING_WASM_SHA256 } from 'zxing-wasm/reader'
import { readerCandidate } from './barcode-reader-result'

// This worker never owns a camera and only receives one ephemeral pixel buffer at a time.
const scope = self as unknown as {
  location: Location
  onmessage: ((event: MessageEvent<{ type: 'init' } | { type: 'frame'; image: ImageData }>) => void) | null
  postMessage: (value: unknown) => void
}
let ready = false
let busy = false
scope.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    if (busy || ready) return
    busy = true
    try {
      const url = new URL('/vendor/zxing-wasm/3.1.3/zxing_reader.wasm', scope.location.origin)
      const response = await fetch(url, { credentials: 'omit', redirect: 'error' })
      if (!response.ok) throw new Error('load')
      const binary = await response.arrayBuffer()
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', binary))].map((n) => n.toString(16).padStart(2, '0')).join('')
      if (hash !== ZXING_WASM_SHA256) throw new Error('integrity')
      await prepareZXingModule({ fireImmediately: true, overrides: {
        wasmBinary: binary,
        locateFile: () => url.href,
        print: () => {}, printErr: () => {},
      } })
      ready = true
      scope.postMessage({ type: 'ready' })
    } catch { scope.postMessage({ type: 'load-error' }) }
    finally { busy = false }
    return
  }
  if (!ready || busy) { data.image.data.fill(0); return }
  busy = true
  try {
    const results = await readBarcodes(data.image, {
      formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], maxNumberOfSymbols: 1,
      tryHarder: false, tryRotate: true, tryInvert: false, returnErrors: true,
    })
    // Only bounded structured identification leaves the worker, never pixels or diagnostics.
    scope.postMessage({ type: 'result', results: results.slice(0, 1).map(readerCandidate) })
  } catch { scope.postMessage({ type: 'decode-error' }) }
  finally { data.image.data.fill(0); busy = false }
}
