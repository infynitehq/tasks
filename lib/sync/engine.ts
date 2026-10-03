import type { Todo } from "../todo-store"
import type { RoomHandle } from "./transport"
import { recordHash } from "./merge"
import { b64u, groupProof, randomBytes, safeEqual } from "./crypto"
import {
  ACTIONS,
  LIMITS,
  PROTO,
  parseDigest,
  parseHello,
  parseProof,
  parseRecordsMsg,
  validateTodo,
} from "./protocol"

// One running connection to the sync group's room.
//
// Handshake, per peer and in both directions:
//   hello  { proto, deviceId, name, nonce }   — my challenge for you
//   proof  { mac = HMAC(groupKey, yourNonce|myDeviceId) }
// Only after I have verified YOUR proof do I accept your digests and records.
// Then:
//   digest { id → hash }  — what I hold
//   recs   [Todo…]        — what you are missing or hold differently
// Live edits are sent as recs to every verified peer.

export interface SyncStore {
  records(): Todo[]
  mergeRemote(records: Todo[]): void
  onLocalChange(fn: (changed: Todo[]) => void): () => void
}

export interface PeerInfo {
  peerId: string
  deviceId: string
  name: string
}

interface PeerState {
  myNonce: string
  hello: { deviceId: string; name: string } | null
  pendingProof: string | null
  verified: boolean
  pendingDigest: Record<string, string> | null
  windowStart: number
  windowCount: number
}

export interface SessionOptions {
  room: RoomHandle
  store: SyncStore
  groupKey: Uint8Array
  identity: { deviceId: string; name: string }
  onPeersChange: (peers: PeerInfo[]) => void
  now?: () => number
  flushDelayMs?: number
}

export function startSession(opts: SessionOptions) {
  const { room, store, groupKey, identity, onPeersChange } = opts
  const now = opts.now ?? Date.now
  const flushDelay = opts.flushDelayMs ?? 120

  const hello = room.channel(ACTIONS.hello)
  const proof = room.channel(ACTIONS.proof)
  const digest = room.channel(ACTIONS.digest)
  const recs = room.channel(ACTIONS.records)

  const peers = new Map<string, PeerState>()
  let stopped = false
  let outbox = new Map<string, Todo>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const verifiedPeers = (): PeerInfo[] =>
    [...peers.entries()]
      .filter(([, p]) => p.verified && p.hello)
      .map(([peerId, p]) => ({ peerId, deviceId: p.hello!.deviceId, name: p.hello!.name }))

  function ensurePeer(peerId: string): PeerState {
    let p = peers.get(peerId)
    if (!p) {
      p = {
        myNonce: b64u(randomBytes(16)),
        hello: null,
        pendingProof: null,
        verified: false,
        pendingDigest: null,
        windowStart: now(),
        windowCount: 0,
      }
      peers.set(peerId, p)
      hello.send({ proto: PROTO, deviceId: identity.deviceId, name: identity.name, nonce: p.myNonce }, peerId)
    }
    return p
  }

  function sendRecords(records: Todo[], peerId?: string) {
    for (let i = 0; i < records.length; i += LIMITS.recordsPerMessage) {
      recs.send({ records: records.slice(i, i + LIMITS.recordsPerMessage) }, peerId)
    }
  }

  function sendDigest(peerId: string) {
    const entries: Record<string, string> = {}
    for (const t of store.records()) entries[t.id] = recordHash(t)
    digest.send({ entries }, peerId)
  }

  function answerDigest(peerId: string, theirs: Record<string, string>) {
    const missing = store.records().filter((t) => theirs[t.id] !== recordHash(t))
    if (missing.length) sendRecords(missing, peerId)
  }

  async function tryVerify(peerId: string) {
    const p = peers.get(peerId)
    if (!p || p.verified || !p.hello || !p.pendingProof) return
    // Both the hello and proof handlers call this, so two runs can overlap.
    // Capture the proof before awaiting and re-check state after, or the
    // second run reads a proof the first has already consumed.
    const theirs = p.pendingProof
    const expected = await groupProof(groupKey, p.myNonce, p.hello.deviceId)
    if (stopped || p.verified || peers.get(peerId) !== p) return
    if (!safeEqual(expected, theirs)) {
      if (p.pendingProof === theirs) p.pendingProof = null
      return
    }
    p.verified = true
    p.pendingProof = null
    sendDigest(peerId)
    if (p.pendingDigest) {
      answerDigest(peerId, p.pendingDigest)
      p.pendingDigest = null
    }
    onPeersChange(verifiedPeers())
  }

  room.onPeerJoin((peerId) => {
    if (!stopped) ensurePeer(peerId)
  })

  room.onPeerLeave((peerId) => {
    const was = peers.get(peerId)?.verified
    peers.delete(peerId)
    if (was && !stopped) onPeersChange(verifiedPeers())
  })

  hello.onMessage(async (data, peerId) => {
    if (stopped) return
    const h = parseHello(data)
    if (!h || h.proto !== PROTO) return
    // Another tab on this same device: nothing to exchange.
    if (h.deviceId === identity.deviceId) return
    const p = ensurePeer(peerId)
    if (p.hello) return // one hello per connection
    p.hello = { deviceId: h.deviceId, name: h.name }
    proof.send({ mac: await groupProof(groupKey, h.nonce, identity.deviceId) }, peerId)
    void tryVerify(peerId)
  })

  proof.onMessage((data, peerId) => {
    if (stopped) return
    const pr = parseProof(data)
    const p = peers.get(peerId)
    if (!pr || !p || p.verified) return
    p.pendingProof = pr.mac
    void tryVerify(peerId)
  })

  digest.onMessage((data, peerId) => {
    if (stopped) return
    const d = parseDigest(data)
    const p = peers.get(peerId)
    if (!d || !p) return
    if (p.verified) answerDigest(peerId, d.entries)
    else p.pendingDigest = d.entries
  })

  recs.onMessage((data, peerId) => {
    if (stopped) return
    const p = peers.get(peerId)
    if (!p?.verified) return
    const raw = parseRecordsMsg(data)
    if (!raw) return

    const t = now()
    if (t - p.windowStart > 60_000) {
      p.windowStart = t
      p.windowCount = 0
    }
    p.windowCount += raw.length
    if (p.windowCount > LIMITS.recordsPerMinute) return

    const valid: Todo[] = []
    for (const r of raw) {
      const v = validateTodo(r, t)
      if (v) valid.push(v)
    }
    if (valid.length) store.mergeRemote(valid)
  })

  function flush() {
    flushTimer = null
    if (stopped || !outbox.size) return
    const batch = [...outbox.values()]
    outbox = new Map()
    for (const peerId of peers.keys()) {
      if (peers.get(peerId)?.verified) sendRecords(batch, peerId)
    }
  }

  const unsubscribe = store.onLocalChange((changed) => {
    if (stopped) return
    for (const t of changed) outbox.set(t.id, t)
    if (!flushTimer) flushTimer = setTimeout(flush, flushDelay)
  })

  return {
    peers: verifiedPeers,
    stop() {
      stopped = true
      unsubscribe()
      if (flushTimer) clearTimeout(flushTimer)
      peers.clear()
    },
  }
}

export type Session = ReturnType<typeof startSession>
