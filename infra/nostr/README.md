# Nostr relay

Self-hosted WebRTC signaling with nostr-rs-relay and automatic HTTPS via Caddy.

## Requirements

- Linux x86-64 VPS with Docker and Compose **2.23.1+**.
- Relay domain pointing to the VPS IP (use DNS-only mode initially).
- TCP ports **80 and 443** open and available.

## Deploy

From `infra/nostr` on the VPS:

```bash
cp .env.example .env
```

Set `NOSTR_DOMAIN` in `.env` to your hostname, without a scheme or path.
This is the only deployment variable; other settings live in `compose.yaml`.

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose logs --tail=100
```

Verify using your actual hostname:

```bash
curl --fail https://nostr.example.com/ -H 'Accept: application/nostr+json'
```

## Connect the app

Set in Vercel, or the app's root `.env.local`:

```dotenv
NEXT_PUBLIC_NOSTR_RELAY_URLS=wss://nostr.example.com
```

Redeploy/restart the app, reload both devices, and test pairing and task sync.
This URL is public—never include secrets.

## Maintenance

- Apply `.env` changes: `docker compose up -d --force-recreate`.
- Stop: `docker compose down`. Avoid `--volumes` to keep database/certificates.
- This is an **open relay**: monitor resource usage and abuse. Keep `.env` private.
- Signaling only; task records travel over WebRTC. Optional TURN fallback
  deployment is in [`../turn`](../turn/README.md).

[Upstream documentation](https://github.com/scsibug/nostr-rs-relay)
