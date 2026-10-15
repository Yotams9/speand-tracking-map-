import type { NextConfig } from 'next'

const private172DevOrigins = Array.from(
  { length: 16 },
  (_, index) => `172.${index + 16}.*.*`,
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Local diagnostics/reservations are never hosted function dependencies.
  // Hosted quotas use Redis; ordinary provider paths never read these files.
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    '/*': ['./artifacts/**/*', './qa/**/*', './tools/**/*', './docs/**/*',
      './.vercel/**/*', './.git/**/*', './.agents/**/*', './.claude/**/*',
      './.cache/**/*', './.env*', './**/*.test.ts', './**/*.test.mjs'],
  },
  // Next 16 blocks dev assets requested through a hostname other than the
  // server's bind host. Keep phone testing limited to loopback and RFC 1918.
  allowedDevOrigins: [
    '127.0.0.1',
    '10.*.*.*',
    '192.168.*.*',
    ...private172DevOrigins,
  ],
  // The barcode catalog route reads its published-price snapshot from disk.
  outputFileTracingIncludes: {
    '/api/catalog/[gtin]': ['./data/catalog/*.json'],
    '/api/catalog/stores': ['./data/catalog/*.json'],
  },
}

export default nextConfig
