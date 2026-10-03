import type { Stamp } from "../todo-store"

/** A remote stamp further than this into the future is rejected. */
export const MAX_SKEW_MS = 24 * 60 * 60 * 1000

/** Device id used in rollover stamps; sorts after every real device id. */
export const ROLLOVER_NODE = "~"

const STAMP_RE = /^(\d{13}):([0-9a-z]{4}):([A-Za-z0-9_~-]{1,32})$/

export function makeStamp(wall: number, counter: number, node: string): Stamp {
  return `${String(wall).padStart(13, "0")}:${counter.toString(36).padStart(4, "0")}:${node}`
}

export function parseStamp(s: unknown): { wall: number; counter: number; node: string } | null {
  if (typeof s !== "string") return null
  const m = STAMP_RE.exec(s)
  if (!m) return null
  return { wall: Number(m[1]), counter: parseInt(m[2], 36), node: m[3] }
}

export function isPlausibleStamp(s: unknown, now = Date.now()): boolean {
  const p = parseStamp(s)
  return p !== null && p.wall <= now + MAX_SKEW_MS
}

/**
 * Deterministic stamp for tasks created by rollover. Every device rolling the
 * same task onto the same day writes byte-identical records, so they converge
 * with no churn. A real edit made later that day carries a later stamp and wins.
 */
export function rolloverStamp(dateKey: string): Stamp {
  return makeStamp(new Date(dateKey + "T00:00:00").getTime(), 0, ROLLOVER_NODE)
}

/** Hybrid logical clock: never runs backwards, follows later remote stamps. */
export class Clock {
  node: string
  private wall = 0
  private counter = 0
  private now: () => number

  constructor(node: string, now: () => number = Date.now) {
    this.node = node
    this.now = now
  }

  tick(): Stamp {
    const n = this.now()
    if (n > this.wall) {
      this.wall = n
      this.counter = 0
    } else {
      this.counter++
    }
    return makeStamp(this.wall, this.counter, this.node)
  }

  observe(stamp: Stamp) {
    const p = parseStamp(stamp)
    if (!p || p.wall > this.now() + MAX_SKEW_MS) return
    if (p.wall > this.wall) {
      this.wall = p.wall
      this.counter = p.counter
    } else if (p.wall === this.wall && p.counter > this.counter) {
      this.counter = p.counter
    }
  }
}
