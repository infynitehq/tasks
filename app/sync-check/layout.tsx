import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sync Diagnostics',
  robots: { index: false, follow: false },
}

export default function SyncCheckLayout({ children }: { children: React.ReactNode }) {
  return children
}
