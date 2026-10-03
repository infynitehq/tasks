# v0-todo-list

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_iDPfVAep6jl0fUbiHXzCKiQPPeXh)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Self-hosted sync signaling

Environment-based configuration and deployment instructions for a Nostr
relay are in [`infra/nostr`](infra/nostr/README.md).
Run that stack on a Linux VPS with Docker; the app itself can stay on Vercel.
Optional authenticated TURN fallback deployment is in [`infra/turn`](infra/turn/README.md).
The app fetches short-lived TURN credentials from `/api/turn` when server-only
`TURN_URLS` and `TURN_SHARED_SECRET` are set. Visit `/sync-check` to verify
authenticated TURN allocations and relay-only data transfer for each URL.

Copy `.env.example` to `.env.local` for optional app relay URLs and development
origins. If `.env.local` already exists, add the entries instead of overwriting
it. `NEXT_PUBLIC_*` values are visible in the browser, not secrets.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
