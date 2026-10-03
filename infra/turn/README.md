# TURN fallback

Authenticated coturn server for WebRTC traffic when direct connections fail.
It complements Nostr signaling; it does not replace it. Can run on the same VPS.

## Requirements

- Linux VPS with Docker and Compose **2.23.1+**.
- DNS-only `A` record for your TURN hostname pointing to the VPS IPv4.
- Open **3478 TCP/UDP** and **49160–49200 UDP** on host/provider firewalls.
- If behind simple 1:1 NAT, forward these ports unchanged.
- Outbound DNS access for automatic public-IP discovery at startup.

## Deploy

From `infra/turn` on the VPS:

```bash
cp .env.example .env
openssl rand -hex 32
```

Set the two required values in `.env`:
- `TURN_DOMAIN`: hostname only, e.g. `turn.example.com`.
- `TURN_SHARED_SECRET`: the generated random secret. Keep this file private.

Clients use your fixed hostname. At startup, the server detects its public IPv4
and the local source IPv4 selected by the host routing table. It binds relay
sockets to that local address and configures an explicit public/private mapping.
Keep the DNS record pointing to the VPS. Discovery failure prevents startup.

For multi-interface hosts, optionally set `TURN_RELAY_IP` in the VPS's `.env`
to the local interface IPv4; normally it can stay empty. Deployment-specific IPs
belong in that ignored environment file, not the Compose configuration.

The startup script allows the selected relay interface as a peer destination
so two clients using this same TURN server can connect after coturn maps the
public address back to the local address. Other private-address deny rules
remain active. This is an IP-wide exception, not restricted to the relay ports;
services bound to that interface should have appropriate host firewall rules.
Deploy `start.sh` alongside `compose.yaml`; Compose mounts it into the container.

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose logs --tail=100
```

Use `config --quiet`; printing rendered Compose configuration exposes the secret.
Host networking means the firewall, not Docker port mappings, controls access.

## App integration

Set these **server-only** environment variables in the Vercel `tasks` project
(Production and any Preview deployments that should support TURN):

```dotenv
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
TURN_SHARED_SECRET=<the same secret already configured on coturn>
```

For local development, add them to the app's `.env.local`. Redeploy after changing
Vercel variables. Never use a `NEXT_PUBLIC_` prefix for the shared secret.

`POST /api/turn` issues coturn-compatible credentials valid for one hour, with
no-store responses. The browser supplies these to Trystero for pairing and sync;
direct connections remain preferred. Active sync rooms rejoin every 45 minutes
to renew their configuration (a brief reconnect). Credential request failures
surface as connection errors and sync retries with backoff. When both settings
are absent, direct-only sync remains available; a partial configuration fails.

This is an account-free app, so issuance is public, not user-authenticated.
The endpoint rejects cross-origin browser requests and includes a bounded,
per-instance rate limiter (20 requests/IP/minute). For deployment-wide abuse
control, add a **Vercel Firewall rate-limit rule** matching `/api/turn`:
20 requests per IP per 60 seconds, action rate-limit/block. Per-instance limits
and Origin headers alone do not prevent non-browser abuse. Keep coturn's
allocation and bandwidth caps enabled.

## Optional TLS TURN on TCP 443

1. Reserve TCP 443 for coturn and open it in both VPS/provider firewalls.
   **Caddy and coturn cannot both listen on the same IP/port.** If your Nostr
   relay uses Caddy on this VPS, use a separate TURN VPS/IP or configure a TCP
   SNI-routing proxy separately. Different DNS names on the same IP do not fix
   a port conflict. Do not stop Nostr's Caddy just to free the port.
2. Obtain a trusted certificate for `TURN_DOMAIN` (DNS-01 issuance avoids
   needing a separate HTTP listener). Copy the actual certificate/key files to
   `infra/turn/tls/fullchain.pem` and `infra/turn/tls/privkey.pem`; do not use
   symlinks pointing outside that mounted directory. Restrict key access while
   ensuring coturn can read it. The directory is gitignored.
3. Set `TURN_TLS_ENABLED=true` in the VPS's `infra/turn/.env`, then run
   `docker compose up -d --force-recreate`. Missing/empty certificate files
   cause startup to fail. Arrange certificate renewal and restart coturn after
   renewed files have been copied.
4. Append `turns:turn.example.com:443?transport=tcp` to Vercel's `TURN_URLS`
   and redeploy. Keep the UDP/TCP URLs for networks where they work.

## Verification

- Open `/sync-check` on the deployed app and click **Test TURN**. Each URL is
  tested separately with relay-only ICE, authenticated allocations, an echoed
  data message, and verification of the selected relay candidate. Run on Wi-Fi
  and mobile data. A running container or STUN response is not sufficient.
- Pair two devices on different networks; create, edit, complete and delete
  tasks on each and confirm convergence.
- Toggle airplane mode, switch Wi-Fi/mobile, and background/reopen the app.
  Confirm devices reconnect and offline changes converge when both are online.
- Leave both devices open for over 45 minutes and verify sync still works
  after credential renewal. Test blocked UDP/TCP 3478 to exercise TLS-only use.
- Nostr and TURN carry signaling/live traffic, not an offline task mailbox.
  Both devices must overlap online to exchange updates.

## Notes

- TLS TURN is opt-in; Nostr's ordinary HTTP Caddy proxy cannot proxy TURN traffic.
- WebRTC data remains encrypted through the relay. TURN consumes VPS bandwidth.
- Authentication, allocation/bandwidth caps, and private-peer restrictions are
  enabled. Monitor usage; quotas do not replace credential-issuance controls.
- Apply env changes: `docker compose up -d --force-recreate`.
- Stop: `docker compose down`.

[Upstream documentation](https://github.com/coturn/coturn/tree/master/docker/coturn)
