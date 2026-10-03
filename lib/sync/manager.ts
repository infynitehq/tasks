"use client"

import { repo } from "../repo"
import { getMeta, setMeta, deleteMeta } from "../idb"
import { b64u, deriveGroupRoom, fromB64u, randomBytes } from "./crypto"
import { startSession, type Session, type PeerInfo } from "./engine"
import { hostPairing, joinPairing, type Candidate } from "./pairing"
import { decodePairPayload, encodePairPayload, type PairPayload } from "./protocol"
import { joinTrystero, type JoinRoom, type RoomHandle } from "./transport"

export interface KnownDevice {
  deviceId: string
  name: string
  lastSeen: number
}

export type HostStage = "starting" | "waiting" | "confirm" | "done" | "expired" | "error"
export type JoinStage = "confirm" | "connecting" | "approve" | "done" | "denied" | "expired" | "error"

export type Pairing =
  | { role: "host"; stage: HostStage; link: string; expiresAt: number; candidate: Candidate | null; error?: string }
  | { role: "join"; stage: JoinStage; hostName: string; code: string | null; payload: PairPayload; error?: string }

export interface SyncState {
  ready: boolean
  enabled: boolean
  /** Joined the group room; may still have no device online. */
  connected: boolean
  online: PeerInfo[]
  devices: KnownDevice[]
  me: { deviceId: string; name: string }
  pairing: Pairing | null
  error: string | null
}

const GROUP_META = "syncGroup"
const DEVICES_META = "syncDevices"
/** Leave the room after this long in the background; rejoin when visible. */
const IDLE_LEAVE_MS = 60_000

class SyncManager {
  private state: SyncState = {
    ready: false,
    enabled: false,
    connected: false,
    online: [],
    devices: [],
    me: { deviceId: "", name: "" },
    pairing: null,
    error: null,
  }
  private listeners = new Set<() => void>()
  private join: JoinRoom = joinTrystero
  private groupKey: Uint8Array | null = null
  private room: RoomHandle | null = null
  private session: Session | null = null
  private connecting: Promise<void> | null = null
  private host: Awaited<ReturnType<typeof hostPairing>> | null = null
  private joiner: Awaited<ReturnType<typeof joinPairing>> | null = null
  private pairTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private initPromise: Promise<void> | null = null

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getSnapshot = () => this.state
  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }
  private setPairing(p: Pairing | null) {
    this.set({ pairing: p })
  }

  init() {
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((e) => {
        console.warn("Sync init failed", e)
        // Allow a later attempt, and tell the sheet why it has nothing to show.
        this.initPromise = null
        this.set({
          ready: true,
          enabled: false,
          error:
            typeof crypto === "undefined" || !crypto.subtle
              ? "Sync needs a secure (https) connection in this browser."
              : "Sync couldn't start in this browser. Try reloading the page.",
        })
      })
    }
    return this.initPromise
  }

  private async doInit() {
    await repo.load()
    const stored = await getMeta<string>(GROUP_META)
    const devices = (await getMeta<KnownDevice[]>(DEVICES_META)) ?? []
    this.groupKey = stored ? fromB64u(stored) : null
    this.set({
      ready: true,
      enabled: Boolean(this.groupKey),
      devices,
      me: { deviceId: repo.device.id, name: repo.device.name },
    })

    document.addEventListener("visibilitychange", this.onVisibility)
    window.addEventListener("online", this.onOnline)

    if (this.groupKey) void this.connect()
  }

  // ── Group room ─────────────────────────────────────────────────────────────

  private connect(): Promise<void> {
    if (!this.groupKey || this.room) return Promise.resolve()
    if (!this.connecting) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = null
      })
    }
    return this.connecting
  }

  private async doConnect() {
    const key = this.groupKey
    if (!key) return
    try {
      const { roomId, password } = await deriveGroupRoom(key)
      const room = await this.join(roomId, password)
      if (this.groupKey !== key) {
        await room.leave()
        return
      }
      this.room = room
      this.session = startSession({
        room,
        store: repo,
        groupKey: key,
        identity: { deviceId: repo.device.id, name: repo.device.name },
        onPeersChange: (peers) => this.onPeers(peers),
      })
      this.set({ connected: true, error: null })
    } catch (e) {
      console.warn("Sync connect failed", e)
      this.set({ connected: false, error: "Couldn't reach the network. Sync will retry when you're back online." })
    }
  }

  private async disconnect() {
    this.session?.stop()
    this.session = null
    const room = this.room
    this.room = null
    this.markOffline(this.state.online)
    this.set({ connected: false, online: [] })
    await room?.leave().catch(() => {})
  }

  private onPeers(peers: PeerInfo[]) {
    const gone = this.state.online.filter((p) => !peers.some((q) => q.deviceId === p.deviceId))
    // Collapse multiple tabs of one device into a single entry.
    const unique = [...new Map(peers.map((p) => [p.deviceId, p])).values()]
    for (const p of unique) this.upsertDevice(p.deviceId, p.name)
    this.markOffline(gone)
    this.set({ online: unique })
  }

  private upsertDevice(deviceId: string, name: string) {
    const now = Date.now()
    const others = this.state.devices.filter((d) => d.deviceId !== deviceId)
    const devices = [{ deviceId, name, lastSeen: now }, ...others]
    this.set({ devices })
    void setMeta(DEVICES_META, devices)
  }

  private markOffline(peers: PeerInfo[]) {
    if (!peers.length) return
    const now = Date.now()
    const devices = this.state.devices.map((d) =>
      peers.some((p) => p.deviceId === d.deviceId) ? { ...d, lastSeen: now } : d
    )
    this.set({ devices })
    void setMeta(DEVICES_META, devices)
  }

  private async adoptGroupKey(key: Uint8Array) {
    if (this.groupKey && b64u(this.groupKey) === b64u(key)) return
    await this.disconnect()
    this.groupKey = key
    await setMeta(GROUP_META, b64u(key))
    this.set({ enabled: true })
    await this.connect()
  }

  private async getOrCreateGroupKey(): Promise<Uint8Array> {
    if (this.groupKey) return this.groupKey
    const key = randomBytes(32)
    await this.adoptGroupKey(key)
    return key
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private onVisibility = () => {
    if (!this.groupKey) return
    if (document.visibilityState === "hidden") {
      if (this.idleTimer) clearTimeout(this.idleTimer)
      this.idleTimer = setTimeout(() => void this.disconnect(), IDLE_LEAVE_MS)
    } else {
      if (this.idleTimer) clearTimeout(this.idleTimer)
      this.idleTimer = null
      void this.connect()
    }
  }

  private onOnline = () => {
    if (!this.groupKey) return
    void this.disconnect().then(() => this.connect())
  }

  // ── Pairing: this device shows the code ────────────────────────────────────

  async startHosting() {
    await this.cancelPairing()
    this.setPairing({ role: "host", stage: "starting", link: "", expiresAt: 0, candidate: null })
    try {
      const host = await hostPairing({
        join: this.join,
        identity: { deviceId: repo.device.id, name: repo.device.name },
        getGroupKey: () => this.getOrCreateGroupKey(),
        callbacks: {
          onCandidate: (candidate) => {
            const p = this.state.pairing
            if (p?.role === "host") this.setPairing({ ...p, stage: "confirm", candidate })
          },
          onPaired: (peer) => {
            this.upsertDevice(peer.deviceId, peer.name)
            const p = this.state.pairing
            if (p?.role === "host") this.setPairing({ ...p, stage: "done" })
            this.clearPairTimer()
            this.host = null
          },
        },
      })
      this.host = host
      const link = `${location.origin}${location.pathname}#pair=${encodePairPayload(host.payload)}`
      this.setPairing({ role: "host", stage: "waiting", link, expiresAt: host.payload.e, candidate: null })
      this.armExpiry(host.payload.e)
    } catch (e) {
      console.warn("Pairing failed to start", e)
      this.setPairing({
        role: "host",
        stage: "error",
        link: "",
        expiresAt: 0,
        candidate: null,
        error: "Couldn't start pairing. Check your connection and try again.",
      })
    }
  }

  async allowCandidate() {
    await this.host?.allow()
  }

  denyCandidate() {
    this.host?.deny()
    const p = this.state.pairing
    if (p?.role === "host") this.setPairing({ ...p, stage: "waiting", candidate: null })
  }

  // ── Pairing: this device scanned the code ──────────────────────────────────

  /** Reads `#pair=…` from the URL. Returns true if a pairing link was found. */
  consumePairLink(): boolean {
    const m = /[#&]pair=([^&]+)/.exec(location.hash)
    if (!m) return false
    history.replaceState(null, "", location.pathname + location.search)
    const payload = decodePairPayload(m[1])
    if (!payload) {
      this.set({ error: "That pairing link isn't valid." })
      return true
    }
    void this.cancelPairing().then(() =>
      this.setPairing({
        role: "join",
        stage: payload.e < Date.now() ? "expired" : "confirm",
        hostName: payload.n,
        code: null,
        payload,
      })
    )
    return true
  }

  async acceptJoin() {
    const p = this.state.pairing
    if (p?.role !== "join" || p.stage !== "confirm") return
    if (p.payload.e < Date.now()) {
      this.setPairing({ ...p, stage: "expired" })
      return
    }
    this.setPairing({ ...p, stage: "connecting" })
    this.armExpiry(p.payload.e)
    try {
      this.joiner = await joinPairing({
        join: this.join,
        identity: { deviceId: repo.device.id, name: repo.device.name },
        payload: p.payload,
        callbacks: {
          onCode: (code) => {
            const cur = this.state.pairing
            if (cur?.role === "join") this.setPairing({ ...cur, stage: "approve", code })
          },
          onWelcome: (key, host) => {
            this.clearPairTimer()
            this.joiner = null
            this.upsertDevice(host.deviceId, host.name)
            void this.adoptGroupKey(key)
            const cur = this.state.pairing
            if (cur?.role === "join") this.setPairing({ ...cur, stage: "done" })
          },
          onDenied: () => {
            this.clearPairTimer()
            this.joiner = null
            const cur = this.state.pairing
            if (cur?.role === "join") this.setPairing({ ...cur, stage: "denied" })
          },
        },
      })
    } catch (e) {
      console.warn("Join pairing failed", e)
      this.setPairing({ ...p, stage: "error", error: "Couldn't reach the other device. Try again." })
    }
  }

  // ── Shared pairing helpers ─────────────────────────────────────────────────

  private armExpiry(at: number) {
    this.clearPairTimer()
    this.pairTimer = setTimeout(() => {
      const p = this.state.pairing
      if (!p || p.stage === "done") return
      void this.closePairRooms()
      this.setPairing({ ...p, stage: "expired" } as Pairing)
    }, Math.max(0, at - Date.now()))
  }

  private clearPairTimer() {
    if (this.pairTimer) clearTimeout(this.pairTimer)
    this.pairTimer = null
  }

  private async closePairRooms() {
    const host = this.host
    const joiner = this.joiner
    this.host = null
    this.joiner = null
    await Promise.all([host?.close(), joiner?.close()])
  }

  async cancelPairing() {
    this.clearPairTimer()
    await this.closePairRooms()
    this.setPairing(null)
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async rename(name: string) {
    await repo.renameDevice(name)
    this.set({ me: { deviceId: repo.device.id, name: repo.device.name } })
    // Peers learn the new name on the next handshake.
    if (this.groupKey) await this.disconnect().then(() => this.connect())
  }

  /** Stop syncing on this device. Tasks stay; the other devices are unaffected. */
  async leave() {
    await this.cancelPairing()
    await this.disconnect()
    this.groupKey = null
    await deleteMeta(GROUP_META)
    await deleteMeta(DEVICES_META)
    this.set({ enabled: false, devices: [], error: null })
  }

  clearError() {
    this.set({ error: null })
  }
}

export const sync = new SyncManager()
