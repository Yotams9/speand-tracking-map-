import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import nextConfig from '../../next.config'

// A hosted build only ships files it can trace. Every API route that reads the
// published catalog from disk must list it, and the routes that only work on
// this computer must be wrapped by the local-only guard.
const apiRoot = join(process.cwd(), 'src', 'app', 'api')
const routes = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? routes(path) : name === 'route.ts' ? [path] : [] })
const routePath = (file: string) => '/api/' + relative(apiRoot, file).split(sep).slice(0, -1).join('/')
const sources = routes(apiRoot).map(file => ({ path: routePath(file), source: readFileSync(file, 'utf8') }))

describe('deployment readiness', () => {
  it('every route that reads the catalog from disk traces data/catalog', () => {
    const readers = sources.filter(r => /loadTelAvivCatalog|data\/price-catalog/.test(r.source)).map(r => r.path).sort()
    expect(readers).toEqual(['/api/catalog/[gtin]', '/api/catalog/search', '/api/catalog/stores', '/api/savings'])
    for (const path of readers) expect(nextConfig.outputFileTracingIncludes?.[path]).toEqual(['./data/catalog/*.json'])
  })
  it('receipt and address routes are local-only; the ordinary routes need no environment variable', () => {
    const localOnly = sources.filter(r => /receipt-|address-search/.test(r.path))
    expect(localOnly.map(r => r.path).sort()).toEqual(['/api/address-search', '/api/receipt-capture-session', '/api/receipt-direct', '/api/receipt-ocr', '/api/receipt-structured'])
    for (const r of localOnly) {
      expect(r.source).toMatch(/localOnly|hostedOr/)
      for (const method of r.source.matchAll(/export const (GET|POST)\s*=\s*([^\n]+)/g)) expect(method[2]).toMatch(/^(localOnly\(|handler$)/)
      if (/export const (GET|POST)\s*=\s*handler/.test(r.source)) expect(r.source).toMatch(/const handler\s*=\s*hostedOr\(/)
    }
    for (const r of sources.filter(r => !localOnly.includes(r))) expect(r.source).not.toMatch(/process\.env/)
  })
})
