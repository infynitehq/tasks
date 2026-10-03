// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Hybrid-logical-clock stamp: "<wall ms, 13 digits>:<counter, 4 base36>:<deviceId>".
 * Stamps compare correctly as plain strings.
 */
export type Stamp = string

/**
 * Each field group carries its own stamp so concurrent edits to different
 * groups on different devices both survive a merge:
 *   t = text · c = completed/completedAt · d = date/rolledOverFrom/rolloverCount · x = deleted
 */
export interface Stamps {
  t: Stamp
  c: Stamp
  d: Stamp
  x: Stamp
}

export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: number
  completedAt: number | null
  date: string                  // "YYYY-MM-DD" — the day this task belongs to
  rolledOverFrom: string | null // original date if carried forward
  rolloverCount: number         // how many days it has been carried forward
  origin: string | null         // id of the task this was rolled over from (chain root)
  deleted: boolean              // tombstone: deletes must propagate, not vanish
  s: Stamps
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00")
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

export function isToday(dateKey: string): boolean {
  return dateKey === todayKey()
}

export function isPast(dateKey: string): boolean {
  return dateKey < todayKey()
}

/** Sun=0…Sat=6 week that contains `dateKey`, returns Mon–Sun keys */
export function weekOf(dateKey: string): string[] {
  if (!dateKey) return []
  const d = new Date(dateKey + "T00:00:00")
  const day = d.getDay() // 0=Sun
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7)) // shift to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    return toDateKey(dd)
  })
}

// ─── Selectors ────────────────────────────────────────────────────────────────
// Every selector receives VISIBLE todos only. Tombstones are filtered once, in
// lib/repo.ts, so no selector can accidentally count a deleted task.

export function todosForDate(todos: Todo[], dateKey: string): Todo[] {
  return todos.filter((t) => t.date === dateKey)
}

export function computeStreak(todos: Todo[]): number {
  // Walk backwards from yesterday; count consecutive days with >= 1 task completed
  let streak = 0
  let cursor = addDays(todayKey(), -1)

  for (let i = 0; i < 365; i++) {
    const dayTodos = todosForDate(todos, cursor)
    if (dayTodos.length === 0) {
      // Empty day doesn't break streak, skip
      cursor = addDays(cursor, -1)
      continue
    }
    const anyDone = dayTodos.some((t) => t.completed)
    if (!anyDone) break
    streak++
    cursor = addDays(cursor, -1)
  }

  return streak
}

export function computeRolloverDebt(todos: Todo[]): number {
  const today = todayKey()
  return todos.filter((t) => t.date === today && !t.completed && t.rolloverCount > 0).length
}

export interface DailySummary {
  total: number
  completed: number
  rolledIn: number   // tasks that arrived via rollover
  completionPct: number
}

export function dailySummary(todos: Todo[], dateKey: string): DailySummary {
  const day = todosForDate(todos, dateKey)
  const completed = day.filter((t) => t.completed).length
  const rolledIn = day.filter((t) => t.rolloverCount > 0).length
  const total = day.length
  return {
    total,
    completed,
    rolledIn,
    completionPct: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export interface DayBar {
  dateKey: string
  label: string      // "Mon", "01" etc
  total: number
  completed: number
  completionPct: number
  isToday: boolean
}

export function last30Days(todos: Todo[]): DayBar[] {
  const today = todayKey()
  return Array.from({ length: 30 }, (_, i) => {
    const dk = addDays(today, -(29 - i))
    const day = todosForDate(todos, dk)
    const completed = day.filter((t) => t.completed).length
    const total = day.length
    const d = new Date(dk + "T00:00:00")
    return {
      dateKey: dk,
      label: String(d.getDate()).padStart(2, "0"),
      total,
      completed,
      completionPct: total === 0 ? 0 : Math.round((completed / total) * 100),
      isToday: dk === today,
    }
  })
}

export type WeekDay = ReturnType<typeof weekSummary>[number]

export function weekSummary(todos: Todo[], dateKey: string) {
  return weekOf(dateKey).map((dk) => {
    const day = todosForDate(todos, dk)
    const completed = day.filter((t) => t.completed).length
    const total = day.length
    return {
      dateKey: dk,
      total,
      completed,
      completionPct: total === 0 ? 0 : Math.round((completed / total) * 100),
      isToday: dk === todayKey(),
      isPast: dk < todayKey(),
    }
  })
}
