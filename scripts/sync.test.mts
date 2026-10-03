// pnpm run test:sync
import { mergeTodo, mergeInto, sameTodo, planRollover, recordHash } from "../lib/sync/merge.ts"
import { startSession, type SyncStore, type PeerInfo } from "../lib/sync/engine.ts"
import type { RoomHandle, Channel } from "../lib/sync/transport.ts"
import { randomBytes } from "../lib/sync/crypto.ts"
import type { Todo } from "../lib/todo-store.ts"

let failed = 0
let passed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++
  else {
    failed++
    console.log(`FAIL ${name}`, detail ?? "")
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const st = (wall: number, node: string) => `${String(wall).padStart(13, "0")}:0000:${node}`

function todo(id: string, over: Partial<Todo> = {}, wall = 1_000, node = "a"): Todo {
  const s = st(wall, node)
  return {
    id,
    text: id,
    completed: false,
    completedAt: null,
    createdAt: 1,
    date: "2026-01-10",
    rolledOverFrom: null,
    rolloverCount: 0,
    origin: null,
    deleted: false,
    s: { t: s, c: s, d: s, x: s },
    ...over,
  } as Todo
}

// ── Merge is a semilattice ──────────────────────────────────────────────────

const base = todo("x")
const edited = { ...base, text: "edited", s: { ...base.s, t: st(2000, "b") } }
const done = { ...base, completed: true, completedAt: 5, s: { ...base.s, c: st(3000, "a") } }
const gone = { ...base, deleted: true, s: { ...base.s, x: st(1500, "c") } }
const variants = [base, edited, done, gone]

for (const a of variants)
  for (const b of variants) {
    check("commutative", sameTodo(mergeTodo(a, b), mergeTodo(b, a)), [a.text, b.text])
    check("idempotent", sameTodo(mergeTodo(a, a), a))
    for (const c of variants)
      check("associative", sameTodo(mergeTodo(mergeTodo(a, b), c), mergeTodo(a, mergeTodo(b, c))))
  }

const all = variants.reduce(mergeTodo)
check("concurrent edits on different fields both survive", all.text === "edited" && all.completed && all.deleted, all)
check("hash changes with content", recordHash(base) !== recordHash(edited))

const local = new Map([["x", base]])
check("mergeInto reports change", mergeInto(local, [edited]).length === 1)
check("mergeInto is quiet on repeat", mergeInto(local, [edited]).length === 0)

// ── Rollover is deterministic across devices ────────────────────────────────

const past = todo("p", { date: "2026-01-08" })
const r1 = planRollover([past], "2026-01-10")
const r2 = planRollover([past], "2026-01-10")
check("rollover yields one copy", r1.length === 1, r1)
check("rollover is identical on two devices", r1.length === 1 && sameTodo(r1[0], r2[0]) && r1[0].id === r2[0].id)
check("rollover copy is not re-rolled", planRollover([past, ...r1], "2026-01-10").length === 0)
check("completed task does not roll", planRollover([todo("q", { date: "2026-01-08", completed: true })], "2026-01-10").length === 0)
check("deleted task does not roll", planRollover([todo("r", { date: "2026-01-08", deleted: true })], "2026-01-10").length === 0)

// ── Two engines over an in-memory room ──────────────────────────────────────

type Handler = (d: unknown, from: string) => void
class Hub {
  members = new Map<string, { channels: Map<string, Handler[]>; join: ((id: string) => void)[]; leave: ((id: string) => void)[] }>()
  join(id: string): RoomHandle {
    const me = { channels: new Map<string, Handler[]>(), join: [] as ((id: string) => void)[], leave: [] as ((id: string) => void)[] }
    this.members.set(id, me)
    queueMicrotask(() => {
      for (const [other, m] of this.members) {
        if (other === id) continue
        m.join.forEach((f) => f(id))
        me.join.forEach((f) => f(other))
      }
    })
    const hub = this
    return {
      selfId: id,
      channel(name): Channel {
        return {
          send(data, to) {
            const copy = JSON.parse(JSON.stringify(data))
            for (const [other, m] of hub.members) {
              if (other === id || (to && to !== other)) continue
              queueMicrotask(() => (m.channels.get(name) ?? []).forEach((f) => f(copy, id)))
            }
          },
          onMessage(fn) {
            me.channels.set(name, [...(me.channels.get(name) ?? []), fn])
          },
        }
      },
      onPeerJoin: (f) => void me.join.push(f),
      onPeerLeave: (f) => void me.leave.push(f),
      async leave() {
        hub.members.delete(id)
      },
    }
  }
}

function memStore(initial: Todo[]): SyncStore & { map: Map<string, Todo>; edit(t: Todo): void } {
  const map = new Map(initial.map((t) => [t.id, t]))
  const subs: ((c: Todo[]) => void)[] = []
  return {
    map,
    records: () => [...map.values()],
    mergeRemote: (r) => void mergeInto(map, r),
    onLocalChange(fn) {
      subs.push(fn)
      return () => subs.splice(subs.indexOf(fn), 1)
    },
    edit(t) {
      map.set(t.id, t)
      subs.forEach((f) => f([t]))
    },
  }
}

const settle = () => new Promise((r) => setTimeout(r, 400))

const key = randomBytes(32)
const hub = new Hub()
const A = memStore([todo("a1"), todo("shared", { text: "old" })])
const B = memStore([todo("b1"), todo("shared", { text: "new" }, 5000, "b")])
let peersA: PeerInfo[] = []
startSession({ room: hub.join("pa"), store: A, groupKey: key, identity: { deviceId: "devicea01", name: "A" }, onPeersChange: (p) => (peersA = p), flushDelayMs: 10 })
startSession({ room: hub.join("pb"), store: B, groupKey: key, identity: { deviceId: "deviceb01", name: "B" }, onPeersChange: () => {}, flushDelayMs: 10 })
await settle()

const ids = (s: { map: Map<string, Todo> }) => [...s.map.keys()].sort().join(",")
check("initial sync unions both sides", ids(A) === "a1,b1,shared" && ids(B) === "a1,b1,shared", [ids(A), ids(B)])
check("newer edit wins on both", A.map.get("shared")?.text === "new" && B.map.get("shared")?.text === "new")
check("peer is reported verified", peersA.length === 1 && peersA[0].deviceId === "deviceb01", peersA)

A.edit(todo("live", {}, 9000))
await settle()
check("live edit reaches the other device", B.map.has("live"))

// A stranger with the wrong key in the same room must learn and change nothing.
const E = memStore([todo("evil")])
let peersE: PeerInfo[] = []
startSession({ room: hub.join("pe"), store: E, groupKey: randomBytes(32), identity: { deviceId: "devicee01", name: "E" }, onPeersChange: (p) => (peersE = p), flushDelayMs: 10 })
await settle()
check("wrong-key peer injects nothing", !A.map.has("evil") && !B.map.has("evil"))
check("wrong-key peer receives nothing", ids(E) === "evil", ids(E))
check("wrong-key peer is never verified", peersE.length === 0 && peersA.length === 1, [peersE, peersA])

// ── Must-fail: a merge without stamps would let the older value win ─────────

const naive = (a: Todo, b: Todo) => ({ ...a, ...b })
const caught = !sameTodo(naive(edited, base), mergeTodo(edited, base))
check("must-fail: a naive last-write merge is caught", caught)

console.log(`${passed} checks passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
