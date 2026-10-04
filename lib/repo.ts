"use client"

// The single owner of todo state. Lives outside React so the sync engine and
// the UI read and write the same records. Every change, local or remote, goes
// through here: stamp → memory → IndexedDB → other tabs → (local only) peers.

import type { Todo } from "./todo-store"
import { todayKey } from "./todo-store"
import { readAllTodos, putTodos, getMeta, setMeta } from "./idb"
import { createUUID } from "./uuid"
import { Clock } from "./sync/hlc"
import { mergeInto, planRollover } from "./sync/merge"

export interface DeviceIdentity {
  id: string
  name: string
}

const EMPTY: Todo[] = []

function randomId(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

export function defaultDeviceName(): string {
  if (typeof navigator === "undefined") return "This device"
  const ua = navigator.userAgent
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
    ? "iPad"
    : /Android/.test(ua)
    ? "Android"
    : /Mac OS X/.test(ua)
    ? "Mac"
    : /Windows/.test(ua)
    ? "Windows"
    : /Linux/.test(ua)
    ? "Linux"
    : "device"
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser"
  return `${browser} on ${os}`
}

class TodoRepo {
  private map = new Map<string, Todo>()
  private visible: Todo[] = EMPTY
  private listeners = new Set<() => void>()
  private localListeners = new Set<(changed: Todo[]) => void>()
  private channel: BroadcastChannel | null = null
  private clock: Clock | null = null
  private day = ""
  private loading: Promise<void> | null = null
  device: DeviceIdentity = { id: "", name: "" }
  loaded = false

  load(): Promise<void> {
    if (!this.loading) this.loading = this.doLoad()
    return this.loading
  }

  private async doLoad() {
    let device = await getMeta<DeviceIdentity>("device")
    if (!device?.id) {
      device = { id: randomId(10), name: defaultDeviceName() }
      await setMeta("device", device)
    }
    this.device = device
    this.clock = new Clock(device.id)

    for (const t of await readAllTodos()) {
      this.map.set(t.id, t)
      this.observe(t)
    }

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("todo-app-records")
      this.channel.onmessage = (e) => {
        if (Array.isArray(e.data)) this.absorb(e.data as Todo[], false)
      }
    }

    this.day = todayKey()
    this.loaded = true
    this.rebuild()
    this.rollover()
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** Visible (non-deleted) todos. Stable identity between changes. */
  getSnapshot = (): Todo[] => this.visible
  getServerSnapshot = (): Todo[] => EMPTY
  getReadySnapshot = (): boolean => this.loaded
  getServerReadySnapshot = (): boolean => false

  /** Every record, tombstones included. For sync only. */
  records(): Todo[] {
    return [...this.map.values()]
  }

  onLocalChange(fn: (changed: Todo[]) => void) {
    this.localListeners.add(fn)
    return () => {
      this.localListeners.delete(fn)
    }
  }

  async renameDevice(name: string) {
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return
    this.device = { ...this.device, name: trimmed }
    await setMeta("device", this.device)
  }

  // ── Local mutations ────────────────────────────────────────────────────────

  private stamp() {
    if (!this.clock) throw new Error("repo not loaded")
    return this.clock.tick()
  }

  private build(text: string, date: string): Todo {
    const s = this.stamp()
    return {
      id: createUUID(),
      text,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
      date,
      rolledOverFrom: null,
      rolloverCount: 0,
      origin: null,
      deleted: false,
      s: { t: s, c: s, d: s, x: s },
    }
  }

  add(text: string, date: string) {
    this.commit([this.build(text, date)])
  }

  addMany(texts: string[], date: string): number {
    const existing = new Set(
      this.visible.filter((t) => t.date === date).map((t) => t.text.toLowerCase())
    )
    const fresh: Todo[] = []
    for (const text of texts) {
      const key = text.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      fresh.push(this.build(text, date))
    }
    this.commit(fresh)
    return fresh.length
  }

  toggle(id: string) {
    const t = this.map.get(id)
    if (!t || t.deleted) return
    const completed = !t.completed
    this.commit([
      { ...t, completed, completedAt: completed ? Date.now() : null, s: { ...t.s, c: this.stamp() } },
    ])
  }

  remove(ids: string[]) {
    const out: Todo[] = []
    for (const id of ids) {
      const t = this.map.get(id)
      if (t && !t.deleted) out.push({ ...t, deleted: true, s: { ...t.s, x: this.stamp() } })
    }
    this.commit(out)
  }

  private commit(changed: Todo[]) {
    if (!changed.length) return
    for (const t of changed) this.map.set(t.id, t)
    this.rebuild()
    void putTodos(changed)
    this.channel?.postMessage(changed)
    for (const fn of this.localListeners) fn(changed)
  }

  // ── Remote changes ─────────────────────────────────────────────────────────

  /** Merge records from a peer. Input must already be validated. */
  mergeRemote(records: Todo[]) {
    this.absorb(records, true)
  }

  private absorb(records: Todo[], broadcast: boolean) {
    if (!this.loaded || !records.length) return
    for (const r of records) this.observe(r)
    const changed = mergeInto(this.map, records)
    if (changed.length) {
      this.rebuild()
      if (broadcast) {
        void putTodos(changed)
        this.channel?.postMessage(changed)
      }
    }
    // A merged-in task may need carrying forward. Idempotent, so safe to repeat.
    this.rollover()
  }

  private observe(t: Todo) {
    if (!this.clock) return
    this.clock.observe(t.s.t)
    this.clock.observe(t.s.c)
    this.clock.observe(t.s.d)
    this.clock.observe(t.s.x)
  }

  // ── Rollover ───────────────────────────────────────────────────────────────

  private rollover() {
    const copies = planRollover(this.map.values(), todayKey())
    // Copies use a deterministic stamp; move the clock past it so any edit
    // made to them today sorts later.
    for (const c of copies) this.observe(c)
    this.commit(copies)
  }

  /** Call when the page becomes visible again; handles crossing midnight. */
  checkDay() {
    if (!this.loaded) return
    const today = todayKey()
    if (today === this.day) return
    this.day = today
    this.rollover()
    this.emit()
  }

  private rebuild() {
    const next: Todo[] = []
    for (const t of this.map.values()) if (!t.deleted) next.push(t)
    this.visible = next
    this.emit()
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }
}

export const repo = new TodoRepo()
