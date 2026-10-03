#!/bin/sh
set -eu

valid_ipv4() {
  printf '%s\n' "$1" | awk -F. '
    NR != 1 || NF != 4 { exit 1 }
    { for (i = 1; i <= 4; i++) if ($i !~ /^[0-9]+$/ || $i > 255) exit 1 }
    $1 == 0 || $1 == 127 || $1 >= 224 || ($1 == 169 && $2 == 254) { exit 1 }
  '
}

external_ip="$(detect-external-ip)"
if ! valid_ipv4 "$external_ip"; then
  echo 'Could not detect a usable public IPv4 address.' >&2
  exit 1
fi

# Use the source address selected by the host route, rather than a wildcard
# or an arbitrary Docker bridge address. Override for multi-interface hosts.
relay_ip="${TURN_RELAY_IP:-}"
if [ -z "$relay_ip" ]; then
  if ! command -v ip >/dev/null 2>&1; then
    echo 'Missing iproute2. Rebuild with docker compose up -d --build, or set TURN_RELAY_IP explicitly.' >&2
    exit 1
  fi
  relay_ip="$(ip -4 route get "$external_ip" | awk '
    { for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit } }
  ')"
fi
if ! valid_ipv4 "$relay_ip"; then
  echo 'Could not detect a usable relay IPv4 address. Set TURN_RELAY_IP to the host interface address.' >&2
  exit 1
fi

if [ "${TURN_TLS_ENABLED:-false}" = 'true' ]; then
  test -s /etc/coturn/tls/fullchain.pem
  test -s /etc/coturn/tls/privkey.pem
  set -- --tls-listening-port=443 --cert=/etc/coturn/tls/fullchain.pem --pkey=/etc/coturn/tls/privkey.pem
else
  set -- --no-tls
fi

# Coturn maps public peer addresses back to private addresses before checking
# permissions. Allow this relay interface so two allocations can communicate.
exec turnserver -c /etc/coturn/turnserver.conf \
  --relay-ip="$relay_ip" \
  --external-ip="$external_ip/$relay_ip" \
  --allowed-peer-ip="$relay_ip" \
  "$@"
