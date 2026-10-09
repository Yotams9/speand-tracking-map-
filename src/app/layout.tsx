import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Heebo, Inter } from 'next/font/google'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'

// Hebrew glyphs come from Heebo, Latin from Inter; each subset only covers its script.
const heebo = Heebo({ subsets: ['hebrew'], weight: ['400', '500', '600', '700', '800'], variable: '--font-heebo', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Spendscape — your purchase world',
  description: 'Remember every purchase on a living globe and compare published Tel Aviv supermarket prices.',
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
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
