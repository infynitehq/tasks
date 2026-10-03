// WebCrypto helpers. Requires a secure context (https or localhost).

const enc = new TextEncoder()

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function b64u(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function fromB64u(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message) as BufferSource))
}

/**
 * The group key never leaves paired devices. The rendezvous room id and the
 * Trystero password are both derived from it, so a relay sees only an opaque id.
 */
export async function deriveGroupRoom(groupKey: Uint8Array) {
  const [room, pw] = await Promise.all([hmac(groupKey, "room/v1"), hmac(groupKey, "password/v1")])
  return { roomId: b64u(room).slice(0, 22), password: b64u(pw) }
}

/** Proves knowledge of the group key for one fresh challenge. */
export async function groupProof(groupKey: Uint8Array, nonce: string, deviceId: string) {
  return b64u(await hmac(groupKey, `proof/v1|${nonce}|${deviceId}`))
}

/**
 * Four-digit code both devices show during pairing. It is bound to the two
 * peer ids actually connected, so a third device that joined using a
 * photographed QR code produces a different code on one side.
 */
export async function confirmationCode(pairSecret: string, peerA: string, peerB: string) {
  const [x, y] = [peerA, peerB].sort()
  const h = await hmac(fromB64u(pairSecret), `code/v1|${x}|${y}`)
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0
  return String(n % 10000).padStart(4, "0")
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
