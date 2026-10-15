// Loopback-only QA helper: forwards requests to the local production server and
// adds the synthetic-QA opt-in header to same-origin app requests only.
// Playwright's extraHTTPHeaders would also send it to the map tile host, whose
// CORS preflight rejects unknown headers, so the globe would never load.
// Usage: node qa/qa-gate-proxy.mjs <listenPort> <targetPort>
import http from 'node:http'

const [listen, target] = process.argv.slice(2).map(Number)
if (!Number.isInteger(listen) || !Number.isInteger(target)) throw new Error('usage: qa-gate-proxy.mjs <listenPort> <targetPort>')

http.createServer((request, response) => {
  const upstream = http.request({ host: '127.0.0.1', port: target, method: request.method, path: request.url, headers: { ...request.headers, 'x-spendscape-synthetic-qa': '1' } }, reply => {
    response.writeHead(reply.statusCode ?? 502, reply.headers)
    reply.pipe(response)
  })
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end() })
  request.pipe(upstream)
}).listen(listen, '127.0.0.1', () => console.log(`qa-gate proxy http://127.0.0.1:${listen} -> 127.0.0.1:${target}`))
