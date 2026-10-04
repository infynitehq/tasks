# tasks

A minimal, local-first daily todo app. Installable PWA, dark mode, and device sync—no account required.

## Architecture

Next.js + React + Tailwind CSS. Tasks persist in IndexedDB and sync over WebRTC; Nostr handles signaling only.

![tasks-architecture](/public/architecture.png)

## Run locally

```bash
pnpm install
cp .env.example .env.local # only if .env.local doesn't exist
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Set your production `NEXT_PUBLIC_SITE_URL` for canonical links and the sitemap, and `NEXT_PUBLIC_NOSTR_RELAY_URLS` for signaling.

## Redis Integration

Connect **Upstash Redis** through Vercel Marketplace. Configure these server-only variables locally and on Vercel, then redeploy:

```env
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
PAIRING_CODE_SECRET=...
```

Generate `PAIRING_CODE_SECRET` with `openssl rand -hex 32`. Never commit secrets or prefix them with `NEXT_PUBLIC_`.

In the installed PWA, scan a QR code or enter the other device’s eight-character code, then approve the matching numbers. Codes expire after five minutes; Redis stores encrypted temporary pairing details—not tasks or permanent sync keys. QR pairing still works if Redis is unavailable. Camera access and syncing require HTTPS (localhost works for development).

## Deploy

Host the app on Vercel or any Next.js host. Self-host [Nostr](infra/nostr/README.md) and optionally [TURN](infra/turn/README.md) on a VPS.

Keep `TURN_SHARED_SECRET` server-only; `/api/turn` issues temporary credentials. Test connectivity at `/sync-check`.


Built by [Soham Datta](https://sohamdatta.com/).
