import { normalizePairingCode } from "../pairing-code"
import { decodePairPayload, encodePairPayload, type PairPayload } from "./protocol"

async function request(path: string, body: object, signal?: AbortSignal): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) controller.abort()
    const timer = setTimeout(abort, 8000)
    try {
      const response = await fetch(`/api/pairing/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), cache: "no-store", signal: controller.signal,
      })
      if (response.status === 204) return {}
      const data = await response.json()
      if (!response.ok) throw new PairingCodeRequestError(typeof data.error === "string" ? data.error : "Pairing codes are temporarily unavailable. Try scanning the QR code.")
      return data
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
      if (error instanceof PairingCodeRequestError || attempt === 1) {
        throw error instanceof PairingCodeRequestError ? error : new PairingCodeRequestError("Couldn’t reach the pairing service. Try again or scan the QR code.")
      }
      // The same owner/attempt token is reused: network retries are idempotent.
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
    }
  }
  throw new PairingCodeRequestError("Pairing codes are temporarily unavailable.")
}

export class PairingCodeRequestError extends Error {}

export async function registerPairingCode(payload: PairPayload, ownerToken: string, signal: AbortSignal) {
  const data = await request("create", { payload, ownerToken }, signal)
  const code = typeof data.code === "string" ? normalizePairingCode(data.code) : null
  if (!code || typeof data.expiresAt !== "number" || !Number.isSafeInteger(data.expiresAt) || data.expiresAt > payload.e || data.expiresAt <= Date.now()) {
    throw new PairingCodeRequestError("Couldn’t create a pairing code. Scan the QR code instead.")
  }
  return { code, expiresAt: data.expiresAt }
}

export async function resolvePairingCode(code: string, attemptId: string, signal: AbortSignal): Promise<PairPayload> {
  const data = await request("resolve", { code, attemptId }, signal)
  const payload = data.payload ? decodePairPayload(encodePairPayload(data.payload as PairPayload)) : null
  if (!payload || !Number.isSafeInteger(payload.e) || payload.e <= Date.now()) {
    throw new PairingCodeRequestError("That code is no longer available. Ask for a fresh code on the other device.")
  }
  return payload
}

export async function revokePairingCode(code: string, ownerToken: string) {
  // Failure is safe: Redis TTL is the final backstop and the room is closed.
  try { await request("revoke", { code, ownerToken }) } catch { /* no secret-bearing logs */ }
}
