import type { JoinRoom, RoomHandle } from "./transport"
import { b64u, confirmationCode, fromB64u, randomBytes } from "./crypto"
import {
  ACTIONS,
  PAIR_TTL_MS,
  type PairPayload,
  parsePairRequest,
  parsePairWelcome,
} from "./protocol"

// Pairing uses a throwaway room whose id and secret travel in the QR code.
// The group key is only handed over after the host has compared a 4-digit
// code with the joining device and pressed Allow.

export interface Identity {
  deviceId: string
  name: string
}

export interface Candidate {
  peerId: string
  deviceId: string
  name: string
  code: string
}

// ── Host ─────────────────────────────────────────────────────────────────────

export interface HostCallbacks {
  onCandidate(c: Candidate): void
  onPaired(peer: { deviceId: string; name: string }): void
}

export async function hostPairing(opts: {
  join: JoinRoom
  identity: Identity
  getGroupKey: () => Promise<Uint8Array>
  callbacks: HostCallbacks
  now?: () => number
}) {
  const now = opts.now ?? Date.now
  const payload: PairPayload = {
    v: 1,
    r: b64u(randomBytes(16)),
    p: b64u(randomBytes(16)),
    n: opts.identity.name,
    e: now() + PAIR_TTL_MS,
  }
  const room = await opts.join(payload.r, payload.p)
  const req = room.channel(ACTIONS.pairRequest)
  const ok = room.channel(ACTIONS.pairWelcome)
  const no = room.channel(ACTIONS.pairDeny)

  let candidate: Candidate | null = null
  let closed = false

  req.onMessage(async (data, peerId) => {
    if (closed) return
    const r = parsePairRequest(data)
    if (!r) return
    // One candidate at a time. Anyone else who scanned the code is turned away.
    if (candidate && candidate.peerId !== peerId) {
      no.send({}, peerId)
      return
    }
    if (candidate) return
    const code = await confirmationCode(payload.p, room.selfId, peerId)
    candidate = { peerId, deviceId: r.deviceId, name: r.name, code }
    opts.callbacks.onCandidate(candidate)
  })

  room.onPeerLeave((peerId) => {
    if (candidate?.peerId === peerId && !closed) candidate = null
  })

  async function close() {
    if (closed) return
    closed = true
    await room.leave().catch(() => {})
  }

  return {
    payload,
    async allow() {
      if (!candidate || closed) return
      const key = await opts.getGroupKey()
      ok.send({ key: b64u(key), deviceId: opts.identity.deviceId, name: opts.identity.name }, candidate.peerId)
      const peer = { deviceId: candidate.deviceId, name: candidate.name }
      // Give the message a moment to leave before tearing the room down.
      setTimeout(() => void close(), 1500)
      opts.callbacks.onPaired(peer)
    },
    deny() {
      if (!candidate || closed) return
      no.send({}, candidate.peerId)
      candidate = null
    },
    close,
  }
}

// ── Joiner ───────────────────────────────────────────────────────────────────

export interface JoinCallbacks {
  onCode(code: string): void
  onWelcome(key: Uint8Array, host: { deviceId: string; name: string }): void
  onDenied(): void
}

export async function joinPairing(opts: {
  join: JoinRoom
  identity: Identity
  payload: PairPayload
  callbacks: JoinCallbacks
}) {
  const { payload, callbacks } = opts
  const room: RoomHandle = await opts.join(payload.r, payload.p)
  const req = room.channel(ACTIONS.pairRequest)
  const ok = room.channel(ACTIONS.pairWelcome)
  const no = room.channel(ACTIONS.pairDeny)

  let hostPeer: string | null = null
  let closed = false

  room.onPeerJoin(async (peerId) => {
    if (closed || hostPeer) return
    hostPeer = peerId
    callbacks.onCode(await confirmationCode(payload.p, room.selfId, peerId))
    req.send({ deviceId: opts.identity.deviceId, name: opts.identity.name }, peerId)
  })

  ok.onMessage((data, peerId) => {
    if (closed || peerId !== hostPeer) return
    const w = parsePairWelcome(data)
    if (!w) return
    const key = fromB64u(w.key)
    if (key.length !== 32) return
    callbacks.onWelcome(key, { deviceId: w.deviceId, name: w.name })
    void close()
  })

  no.onMessage((_data, peerId) => {
    if (closed || peerId !== hostPeer) return
    callbacks.onDenied()
    void close()
  })

  async function close() {
    if (closed) return
    closed = true
    await room.leave().catch(() => {})
  }

  return { close }
}
