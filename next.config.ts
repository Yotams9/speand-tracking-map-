import type { NextConfig } from 'next'

const private172DevOrigins = Array.from(
  { length: 16 },
  (_, index) => `172.${index + 16}.*.*`,
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next 16 blocks dev assets requested through a hostname other than the
  // server's bind host. Keep phone testing limited to loopback and RFC 1918.
  allowedDevOrigins: [
    '127.0.0.1',
    '10.*.*.*',
    '192.168.*.*',
    ...private172DevOrigins,
  ],
}

export default nextConfig
