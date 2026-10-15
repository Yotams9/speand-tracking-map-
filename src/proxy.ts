import { NextResponse, type NextRequest } from 'next/server'
import { demoOrigin, demoPolicy, demoRequested, demoRequestRole } from './server/demo-access'

export function proxy(request: NextRequest) {
  if (!demoRequested(process.env)) return NextResponse.next()
  const policy = demoPolicy(process.env)
  if (!policy || !demoOrigin(request, policy)) {
    if (request.method === 'GET' && request.nextUrl.pathname === '/demo-access') return NextResponse.next()
    if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.redirect(new URL('/demo-access?error=unavailable', request.url))
    return NextResponse.json({ status: 'demo-unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (['/demo-access', '/api/demo-access'].includes(request.nextUrl.pathname)) {
    const response = NextResponse.next(); response.headers.set('Cache-Control', 'no-store'); response.headers.set('Referrer-Policy', 'same-origin'); response.headers.set('X-Frame-Options', 'DENY'); return response
  }
  if (!demoRequestRole(request, policy)) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ status: 'access-required' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.redirect(new URL('/demo-access', request.url))
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'same-origin')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
