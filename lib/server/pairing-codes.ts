import "server-only"

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"
import { Redis } from "@upstash/redis"
import { PAIRING_CODE_ALPHABET, normalizePairingCode } from "../pairing-code"
import { PAIR_TTL_MS, type PairPayload } from "../sync/protocol"

export class PairingApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message)
  }
}

export const INVALID_CODE = "That code is invalid or no longer available. Ask for a fresh code on the other device."
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

interface RecordValue {
  v: 1
  sealed: string
  owner: string
  fingerprint: string
  expiresAt: number
  attempt?: string
}

// The Redis operations are atomic across all serverless instances. A claim is
// retryable by the same random attempt ID, but never transferable to another.
export const CLAIM_SCRIPT = `-- pairing-claim-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return '' end
local record = cjson.decode(raw)
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if record.expiresAt <= now then redis.call('DEL', KEYS[1]); return '' end
if record.attempt and record.attempt ~= ARGV[1] then return '' end
record.attempt = ARGV[1]
local updated = cjson.encode(record)
redis.call('SET', KEYS[1], updated, 'KEEPTTL')
return updated`

export const REVOKE_SCRIPT = `-- pairing-revoke-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if record.owner ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])`

export const RATE_SCRIPT = `-- pairing-rate-v1
local retry = 0
for i, key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET', key) or '0')
  if count >= tonumber(ARGV[(i - 1) * 2 + 1]) then
    retry = math.max(retry, redis.call('PTTL', key))
  end
end
if retry > 0 then return retry end
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('PEXPIRE', key, ARGV[(i - 1) * 2 + 2]) end
end
return 0`

export function validateToken(value: unknown): string {
  if (typeof value !== "string" || !TOKEN_RE.test(value)) throw new PairingApiError(400, "Invalid pairing request.")
  return value
}

export function validateRegistration(value: unknown, now: number): PairPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PairingApiError(400, "Invalid pairing request.")
  const x = value as Record<string, unknown>
  const secret = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{22}$/.test(v)
    && Buffer.from(v, "base64url").length === 16 && Buffer.from(v, "base64url").toString("base64url") === v
  if (x.v !== 1 || !secret(x.r) || !secret(x.p) || typeof x.n !== "string" || !x.n.trim() || x.n.length > 60
    || typeof x.e !== "number" || !Number.isSafeInteger(x.e) || x.e <= now || x.e > now + PAIR_TTL_MS + 30_000) {
    throw new PairingApiError(400, "Invalid or expired pairing session. Generate a fresh code.")
  }
  return { v: 1, r: x.r, p: x.p, n: x.n.trim(), e: x.e }
}

export class PairingCodeStore {
  private encryptionKey: Buffer

  constructor(private redis: Pick<Redis, "set" | "get" | "eval">, private secret: string, private prefix: string) {
    this.encryptionKey = this.digest("encryption", "v1")
  }

  private digest(domain: string, value: string): Buffer {
    return createHmac("sha256", this.secret).update(`${domain}:${value}`).digest()
  }

  private key(code: string): string {
    return `${this.prefix}:code:${this.digest("code", code).toString("hex")}`
  }

  private seal(payload: PairPayload): string {
    const nonce = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, nonce)
    cipher.setAAD(Buffer.from(this.prefix))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()])
    return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
  }

  private unseal(value: string): PairPayload {
    const [version, nonce, tag, data] = value.split(".")
    if (version !== "v1" || !nonce || !tag || !data) throw new Error("Invalid sealed pairing record")
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, Buffer.from(nonce, "base64url"))
    decipher.setAAD(Buffer.from(this.prefix))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"))
  }

  async limit(operation: "create" | "resolve" | "revoke", ip: string, code?: string) {
    const policies: Array<[string, number, number]> = [
      [`ip:${operation}:${this.digest("ip", ip).toString("hex")}`, operation === "create" ? 5 : operation === "resolve" ? 12 : 20, 60_000],
      ["global:minute", 120, 60_000],
      ["global:hour", 2000, 3_600_000],
    ]
    if (code) policies.push([`attempts:${this.digest("code", code).toString("hex")}`, 8, 60_000])
    const retry = await this.redis.eval<unknown[], number>(RATE_SCRIPT, policies.map(([key]) => `${this.prefix}:rate:${key}`), policies.flatMap(([, limit, window]) => [limit, window]))
    if (retry > 0) throw new PairingApiError(429, "Too many attempts. Please wait before trying again.", Math.ceil(retry / 1000))
  }

  async create(value: unknown, ownerToken: unknown, now = Date.now()) {
    const payload = validateRegistration(value, now)
    const token = validateToken(ownerToken)
    const owner = this.digest("owner", token).toString("hex")
    const fingerprint = this.digest("payload", JSON.stringify(payload)).toString("hex")
    const expiresAt = Math.min(payload.e, now + PAIR_TTL_MS)
    for (let collision = 0; collision < 5; collision++) {
      // Deterministic for this unguessable token: lost creation responses can
      // be retried without creating extra codes or extending the original TTL.
      const bytes = this.digest("allocation", `${token}:${collision}`)
      const code = Array.from(bytes.subarray(0, 8), (byte) => PAIRING_CODE_ALPHABET[byte & 31]).join("")
      const key = this.key(code)
      const record: RecordValue = { v: 1, owner, fingerprint, expiresAt, sealed: this.seal({ ...payload, e: expiresAt }) }
      const result = await this.redis.set(key, record, { nx: true, px: expiresAt - now })
      if (result) return { code, expiresAt }
      const existing = await this.redis.get<RecordValue>(key)
      if (existing?.owner === owner && existing.fingerprint === fingerprint && existing.expiresAt > now) {
        return { code, expiresAt: existing.expiresAt }
      }
    }
    throw new PairingApiError(503, "Pairing codes are temporarily unavailable. Use the QR code instead.")
  }

  async resolve(value: unknown, attemptId: unknown): Promise<PairPayload> {
    const code = typeof value === "string" ? normalizePairingCode(value) : null
    if (!code) throw new PairingApiError(400, "Enter the eight-character pairing code.")
    const attempt = this.digest("attempt", validateToken(attemptId)).toString("hex")
    const raw = await this.redis.eval<unknown[], string | RecordValue>(CLAIM_SCRIPT, [this.key(code)], [attempt])
    if (!raw) throw new PairingApiError(404, INVALID_CODE)
    // Upstash automatically deserializes JSON results unless configured otherwise.
    const record: RecordValue = typeof raw === "string" ? JSON.parse(raw) : raw
    if (record.v !== 1 || record.expiresAt <= Date.now()) throw new PairingApiError(404, INVALID_CODE)
    return this.unseal(record.sealed)
  }

  async revoke(value: unknown, ownerToken: unknown) {
    const code = typeof value === "string" ? normalizePairingCode(value) : null
    if (!code) throw new PairingApiError(400, "Invalid pairing request.")
    const owner = this.digest("owner", validateToken(ownerToken)).toString("hex")
    await this.redis.eval(REVOKE_SCRIPT, [this.key(code)], [owner])
  }
}

export function pairingCodeStore(): PairingCodeStore {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new PairingApiError(503, "Pairing codes are temporarily unavailable. Use the QR code instead.")
  }
  // A dedicated secret is recommended. The already server-only Redis token is
  // the fallback so Marketplace installations work without another credential.
  const secret = process.env.PAIRING_CODE_SECRET || token
  if (secret.length < 32) throw new PairingApiError(503, "Pairing codes are temporarily unavailable. Use the QR code instead.")
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development"
  const deployment = environment === "preview" ? createHmac("sha256", secret).update(process.env.VERCEL_URL || "preview").digest("hex").slice(0, 16) : environment
  const redis = new Redis({ url, token, retry: { retries: 0 }, signal: () => AbortSignal.timeout(4000) })
  return new PairingCodeStore(redis, secret, `tasks:pairing:v1:${deployment}`)
}
