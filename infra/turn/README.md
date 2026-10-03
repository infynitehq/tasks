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

Clients use your fixed hostname. The server detects its public IPv4 at startup;
no IP address is configured in `.env`. Keep the DNS record pointing to the VPS.
Discovery failure prevents startup instead of advertising a private address.

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose logs --tail=100
```

Use `config --quiet`; printing rendered Compose configuration exposes the secret.
Host networking means the firewall, not Docker port mappings, controls access.

## App integration (not wired yet)

The app must obtain short-lived credentials from a trusted backend and pass
them to Trystero's `turnConfig`. **Never expose `TURN_SHARED_SECRET` in browser
code or `NEXT_PUBLIC_*` variables.** Protect credential issuance against abuse.

Use both client transports:

```text
turn:turn.example.com:3478?transport=udp
turn:turn.example.com:3478?transport=tcp
```

Leave ICE policy at its default (`all`) so direct connections remain preferred.
Verify fallback with a forced-relay browser test; a running container or STUN
response alone does not prove authenticated TURN allocations work.

## Notes

- UDP/TCP TURN only; TLS TURN (`turns:`) is not configured. Networks allowing
  only TLS on port 443 need additional setup; Nostr's HTTP Caddy proxy cannot
  proxy TURN traffic.
- WebRTC data remains encrypted through the relay. TURN consumes VPS bandwidth.
- Authentication, allocation/bandwidth caps, and private-peer restrictions are
  enabled. Monitor usage; quotas do not replace credential-issuance controls.
- Apply env changes: `docker compose up -d --force-recreate`.
- Stop: `docker compose down`.

[Upstream documentation](https://github.com/coturn/coturn/tree/master/docker/coturn)
