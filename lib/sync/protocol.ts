import type { Todo } from "../todo-store"
import { isPlausibleStamp } from "./hlc"

// Everything a peer sends is untrusted until it passes these checks. A peer
// holding the group key is one of your own devices, but a buggy or outdated
// build must still not be able to corrupt the store.

export const PROTO = 1

export const LIMITS = {
  text: 2000,
  id: 120,
  name: 60,
  recordsPerMessage: 250,
  digestEntries: 50_000,
  recordsPerMinute: 20_000,
}

/** Trystero action names are limited to 12 bytes. */
export const ACTIONS = {
  hello: "hello",
  proof: "proof",
  digest: "digest",
  records: "recs",
  pairRequest: "pReq",
  pairWelcome: "pOk",
  pairDeny: "pNo",
} as const

export interface Hello {
  proto: number
  deviceId: string
  name: string
  nonce: string
}
export interface ProofMsg {
  mac: string
}
export interface DigestMsg {
  entries: Record<string, string>
}
export interface PairRequest {
  deviceId: string
  name: string
}
export interface PairWelcome {
  key: string
  deviceId: string
  name: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DEVICE_RE = /^[a-z0-9]{6,32}$/
const B64U_RE = /^[A-Za-z0-9_-]{8,128}$/

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}
function str(x: unknown, max: number): x is string {
  return typeof x === "string" && x.length > 0 && x.length <= max
}
export function cleanName(x: unknown): string {
  return typeof x === "string" ? x.trim().slice(0, LIMITS.name) || "Unnamed device" : "Unnamed device"
}

export function parseHello(x: unknown): Hello | null {
  if (!isObj(x) || typeof x.proto !== "number") return null
  if (!str(x.deviceId, 32) || !DEVICE_RE.test(x.deviceId)) return null
  if (!str(x.nonce, 64) || !B64U_RE.test(x.nonce)) return null
  return { proto: x.proto, deviceId: x.deviceId, name: cleanName(x.name), nonce: x.nonce }
}

export function parseProof(x: unknown): ProofMsg | null {
  return isObj(x) && str(x.mac, 128) && B64U_RE.test(x.mac) ? { mac: x.mac } : null
}

export function parseDigest(x: unknown): DigestMsg | null {
  if (!isObj(x) || !isObj(x.entries)) return null
  const keys = Object.keys(x.entries)
  if (keys.length > LIMITS.digestEntries) return null
  const entries: Record<string, string> = {}
  for (const k of keys) {
    const v = (x.entries as Record<string, unknown>)[k]
    if (k.length <= LIMITS.id && typeof v === "string" && v.length <= 16) entries[k] = v
  }
  return { entries }
}

export function parseRecordsMsg(x: unknown): unknown[] | null {
  if (!isObj(x) || !Array.isArray(x.records)) return null
  return x.records.length <= LIMITS.recordsPerMessage ? x.records : null
}

export function parsePairRequest(x: unknown): PairRequest | null {
  if (!isObj(x) || !str(x.deviceId, 32) || !DEVICE_RE.test(x.deviceId)) return null
  return { deviceId: x.deviceId, name: cleanName(x.name) }
}

export function parsePairWelcome(x: unknown): PairWelcome | null {
  if (!isObj(x) || !str(x.key, 64) || !B64U_RE.test(x.key)) return null
  if (!str(x.deviceId, 32) || !DEVICE_RE.test(x.deviceId)) return null
  return { key: x.key, deviceId: x.deviceId, name: cleanName(x.name) }
}

/** Returns a clean copy with only known fields, or null if anything is off. */
export function validateTodo(x: unknown, now = Date.now()): Todo | null {
  if (!isObj(x) || !isObj(x.s)) return null
  const { s } = x
  if (!str(x.id, LIMITS.id)) return null
  if (typeof x.text !== "string" || x.text.length > LIMITS.text) return null
  if (typeof x.completed !== "boolean" || typeof x.deleted !== "boolean") return null
  if (typeof x.createdAt !== "number" || !Number.isFinite(x.createdAt)) return null
  if (x.completedAt !== null && (typeof x.completedAt !== "number" || !Number.isFinite(x.completedAt))) return null
  if (typeof x.date !== "string" || !DATE_RE.test(x.date)) return null
  if (x.rolledOverFrom !== null && (typeof x.rolledOverFrom !== "string" || !DATE_RE.test(x.rolledOverFrom))) return null
  if (!Number.isInteger(x.rolloverCount) || (x.rolloverCount as number) < 0 || (x.rolloverCount as number) > 10_000) return null
  if (x.origin !== null && !str(x.origin, LIMITS.id)) return null
  for (const g of ["t", "c", "d", "x"] as const) {
    if (!isPlausibleStamp(s[g], now)) return null
  }
  return {
    id: x.id,
    text: x.text,
    completed: x.completed,
    createdAt: x.createdAt,
    completedAt: x.completedAt as number | null,
    date: x.date,
    rolledOverFrom: x.rolledOverFrom as string | null,
    rolloverCount: x.rolloverCount as number,
    origin: x.origin as string | null,
    deleted: x.deleted,
    s: { t: s.t as string, c: s.c as string, d: s.d as string, x: s.x as string },
  }
}

// ── Pairing link ─────────────────────────────────────────────────────────────

export interface PairPayload {
  v: 1
  r: string // pairing room id
  p: string // pairing secret (room password + confirmation-code key)
  n: string // host device name
  e: number // expiry, ms since epoch
}

export const PAIR_TTL_MS = 5 * 60 * 1000

export function decodePairPayload(raw: string): PairPayload | null {
  try {
    const pad = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4)
    const json = decodeURIComponent(escape(atob(pad)))
    const x = JSON.parse(json) as unknown
    if (!isObj(x) || x.v !== 1) return null
    if (!str(x.r, 64) || !B64U_RE.test(x.r) || !str(x.p, 64) || !B64U_RE.test(x.p)) return null
    if (typeof x.e !== "number") return null
    return { v: 1, r: x.r, p: x.p, n: cleanName(x.n), e: x.e }
  } catch {
    return null
  }
}

export function encodePairPayload(p: PairPayload): string {
  const json = unescape(encodeURIComponent(JSON.stringify(p)))
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
