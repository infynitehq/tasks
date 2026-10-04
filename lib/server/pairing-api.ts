import "server-only"

import { normalizePairingCode } from "../pairing-code"
import { PairingApiError, pairingCodeStore, validateToken } from "./pairing-codes"
import { isSameOriginRequest } from "./request-origin"

const headers = { "Cache-Control": "no-store", "Vary": "Origin", "Referrer-Policy": "no-referrer" }

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PairingApiError(415, "JSON request required.")
  if (Number(request.headers.get("content-length")) > 2048) throw new PairingApiError(413, "Pairing request is too large.")
  const reader = request.body?.getReader()
  if (!reader) throw new PairingApiError(400, "Invalid pairing request.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2048) { await reader.cancel(); throw new PairingApiError(413, "Pairing request is too large.") }
      chunks.push(value)
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body")
    return body as Record<string, unknown>
  } catch (error) {
    if (error instanceof PairingApiError) throw error
    throw new PairingApiError(400, "Invalid pairing request.")
  } finally {
    reader.releaseLock()
  }
}

export async function handlePairingRequest(request: Request, operation: "create" | "resolve" | "revoke") {
  try {
    if (!isSameOriginRequest(request)) {
      throw new PairingApiError(403, "Same-origin request required.")
    }
    const body = await readBody(request)
    const code = typeof body.code === "string" ? normalizePairingCode(body.code) : null
    if (operation !== "create" && !code) throw new PairingApiError(400, "Enter the eight-character pairing code.")
    validateToken(operation === "resolve" ? body.attemptId : body.ownerToken)
    const store = pairingCodeStore()
    // Vercel overwrites this header. For other hosting environments all clients
    // share a conservative bucket rather than trusting spoofable forwarded IPs.
    const ip = process.env.VERCEL ? (request.headers.get("x-vercel-forwarded-for") || "unknown").slice(0, 128) : "local"
    await store.limit(operation, ip, operation === "resolve" ? code! : undefined)
    if (operation === "create") return Response.json(await store.create(body.payload, body.ownerToken), { headers })
    if (operation === "resolve") return Response.json({ payload: await store.resolve(code, body.attemptId) }, { headers })
    await store.revoke(code, body.ownerToken)
    return new Response(null, { status: 204, headers })
  } catch (error) {
    // Never log request bodies, codes, tokens, payloads or SDK errors that may
    // include credentials. Only fixed, non-sensitive error responses leave here.
    const known = error instanceof PairingApiError
    return Response.json({ error: known ? error.message : "Pairing codes are temporarily unavailable. Use the QR code instead." }, {
      status: known ? error.status : 503,
      headers: { ...headers, ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) },
    })
  }
}
