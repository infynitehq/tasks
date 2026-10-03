import { createHmac, randomUUID } from "node:crypto"

export const TURN_TTL_SECONDS = 3600

/** Coturn's TURN REST authentication. This module must stay server-side. */
export function turnCredentials(env: NodeJS.ProcessEnv, now = Date.now()) {
  const value = env.TURN_URLS?.trim()
  const secret = env.TURN_SHARED_SECRET?.trim()
  if (!value && !secret) return { iceServers: [], expiresAt: null }
  if (!value || !secret) throw new Error("TURN_URLS and TURN_SHARED_SECRET must both be set")
  const urls = [...new Set(value.split(",").map((url) => url.trim()).filter(Boolean))]
  if (!urls.length || urls.some((url) => !/^turns?:[a-z0-9.-]+:\d{1,5}(\?transport=(udp|tcp))?$/i.test(url))) {
    throw new Error("Invalid TURN_URLS")
  }
  const expires = Math.floor(now / 1000) + TURN_TTL_SECONDS
  const username = `${expires}:${randomUUID()}`
  const credential = createHmac("sha1", secret).update(username).digest("base64")
  return { iceServers: [{ urls, username, credential }], expiresAt: expires * 1000 }
}
