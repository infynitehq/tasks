import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegisterSW } from '@/components/register-sw'

export const metadata: Metadata = {
  title: 'Tasks — Minimal Todo',
  description: 'A minimal, aesthetic daily todo list',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tasks',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Browsers can inject attributes such as __gcrremoteframetoken before
    // hydration. Tolerate root attributes only, not mismatches in children.
    <html lang="en" className="light bg-background h-full overflow-x-hidden overflow-y-hidden" suppressHydrationWarning>
      <body className="antialiased h-full overflow-x-hidden overflow-y-hidden">
        {children}
        <RegisterSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
