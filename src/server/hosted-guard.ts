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
