import type { Todo, Stamps } from "../todo-store"
import { rolloverStamp } from "./hlc"

// Pure functions only: no I/O, no clocks, no randomness.

type Group = keyof Stamps

const GROUPS: Record<Group, (keyof Todo)[]> = {
  t: ["text"],
  c: ["completed", "completedAt"],
  d: ["date", "rolledOverFrom", "rolloverCount"],
  x: ["deleted"],
}
const GROUP_KEYS = Object.keys(GROUPS) as Group[]

function groupValue(todo: Todo, g: Group): string {
  return JSON.stringify(GROUPS[g].map((f) => todo[f] ?? null))
}

/**
 * Per group, keep the value with the greater stamp. Equal stamps with
 * different values (possible for rollover records) break on the value itself,
 * so every replica picks the same winner. This is a join semilattice:
 * commutative, associative and idempotent.
 */
export function mergeTodo(a: Todo, b: Todo): Todo {
  if (a === b) return a
  const out: Todo = {
    ...a,
    s: { ...a.s },
    createdAt: Math.min(a.createdAt, b.createdAt),
    origin: a.origin ?? b.origin,
  }
  for (const g of GROUP_KEYS) {
    const sa = a.s[g]
    const sb = b.s[g]
    const bWins = sb > sa || (sb === sa && groupValue(b, g) > groupValue(a, g))
    if (!bWins) continue
    out.s[g] = sb
    for (const f of GROUPS[g]) (out as unknown as Record<string, unknown>)[f] = b[f]
  }
  return out
}

export function sameTodo(a: Todo, b: Todo): boolean {
  if (a.createdAt !== b.createdAt || a.origin !== b.origin) return false
  return GROUP_KEYS.every((g) => a.s[g] === b.s[g] && groupValue(a, g) === groupValue(b, g))
}

/** Merges remote records into `local` in place. Returns the records that changed. */
export function mergeInto(local: Map<string, Todo>, remote: Todo[]): Todo[] {
  const changed: Todo[] = []
  for (const r of remote) {
    const l = local.get(r.id)
    const m = l ? mergeTodo(l, r) : r
    if (!l || !sameTodo(l, m)) {
      local.set(r.id, m)
      changed.push(m)
    }
  }
  return changed
}

/** Short content hash used in digests. Covers stamps AND values. */
export function recordHash(t: Todo): string {
  const src = GROUP_KEYS.map((g) => t.s[g] + groupValue(t, g)).join("|") + `|${t.createdAt}|${t.origin}`
  let h = 0x811c9dc5
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * Rollover as a pure function of the records, so every device computes the
 * same result regardless of when it was last opened.
 *
 * Tasks form chains (original → copy on the next day → …) sharing a root id.
 * For each chain, the head is the latest-dated record. If the head is in the
 * past, incomplete and not deleted, a copy is placed on today with an id
 * derived from (root, today) — identical on every device.
 */
export function planRollover(records: Iterable<Todo>, today: string): Todo[] {
  const heads = new Map<string, Todo>()
  for (const r of records) {
    const root = r.origin ?? r.id
    const cur = heads.get(root)
    if (!cur || r.date > cur.date) heads.set(root, r)
  }
  const stamp = rolloverStamp(today)
  const copies: Todo[] = []
  for (const [root, head] of heads) {
    if (head.date >= today || head.deleted || head.completed) continue
    copies.push({
      id: `${root}@${today}`,
      text: head.text,
      completed: false,
      completedAt: null,
      createdAt: head.createdAt,
      date: today,
      rolledOverFrom: head.rolledOverFrom ?? head.date,
      rolloverCount: head.rolloverCount + 1,
      origin: root,
      deleted: false,
      // Text keeps the head's stamp so a later edit anywhere in the chain still wins.
      s: { t: head.s.t, c: stamp, d: stamp, x: stamp },
    })
  }
  return copies
}
