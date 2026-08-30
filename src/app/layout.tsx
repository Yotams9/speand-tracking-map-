import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spendscape — your purchase world',
  description: 'A globe-first purchase-intelligence concept using synthetic data only.',
  applicationName: 'Spendscape',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-maskable.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#090a0d',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  )
}
