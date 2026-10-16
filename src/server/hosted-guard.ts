// Receipt recognition and address search run only on the person's own computer
// (loopback). On a hosted deployment, or for any non-loopback request, these
// routes answer a plain 404 before their handler runs: no file, key, quota or
// provider is touched, and no error detail is returned.
const loopback = (hostname: string) => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)
function localRequest(request: Request): boolean {
  try {
    const url = new URL(request.url)
    const host = new URL(`http://${request.headers.get('host') ?? url.host}`)
    const forwarded = request.headers.get('x-forwarded-host')
    return loopback(url.hostname) && loopback(host.hostname) && (!forwarded || loopback(new URL(`http://${forwarded.split(',')[0].trim()}`).hostname))
  } catch { return false }
}
export const LOCAL_ONLY = { status: 'disabled', code: 'local-only' } as const
export function localOnly(handler: (request: Request) => Response | Promise<Response>, env: Record<string, string | undefined> = process.env) {
  return async (request: Request): Promise<Response> => {
    if (env.VERCEL || !localRequest(request)) return Response.json(LOCAL_ONLY, { status: 404, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } })
    return handler(request)
  }
}
// With SPENDSCAPE_HOSTED_MODE set (Shon's protected demo / presentation mode), the
// hosted handler runs; it checks its own policy, origin, quota and keys and fails
// closed. Without it, the route stays local-only exactly as before.
export function hostedOr(hosted: (request: Request) => Response | Promise<Response>, local: (request: Request) => Response | Promise<Response>, env: Record<string, string | undefined> = process.env) {
  return env.SPENDSCAPE_HOSTED_MODE ? hosted : localOnly(local, env)
}
