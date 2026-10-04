import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/sync-check'],
    },
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  }
}
