import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { RegisterSW } from '@/components/register-sw'
import { ThemeProvider } from '@/components/theme-provider'
import { appDescription, appTitle, developer, siteUrl } from '@/lib/site-metadata'

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: appTitle,
    template: '%s | Tasks',
  },
  description: appDescription,
  applicationName: 'Tasks',
  authors: [{ name: developer.name, url: developer.url }],
  creator: developer.name,
  category: 'productivity',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: siteUrl,
    locale: 'en_US',
    siteName: 'Tasks',
    title: appTitle,
    description: appDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: appTitle,
    description: appDescription,
    creator: '@tech_savvy_guy_',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tasks',
  },
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
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
    <html lang="en" className="bg-background h-full overflow-x-hidden overflow-y-hidden" suppressHydrationWarning>
      <body className="antialiased h-full overflow-x-hidden overflow-y-hidden">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <RegisterSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
