// Set this to the public production origin, not a preview deployment URL.
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL

export const siteUrl = configuredUrl ? new URL(configuredUrl).origin : undefined
export const appTitle = 'Tasks — Minimal Daily Todo App'
export const appDescription =
  'Capture daily tasks, track your progress, and sync between devices with WebRTC.'
export const developer = {
  name: 'Soham Datta',
  url: 'https://sohamdatta.com/',
  profiles: [
    'https://github.com/tech-savvy-guy',
    'https://x.com/tech_savvy_guy_',
  ],
}
