"use client"

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import {
  todayKey,
  addDays,
  isPast,
  isToday,
  todosForDate,
  computeStreak,
  computeRolloverDebt,
  dailySummary,
  weekSummary,
  last30Days,
  type DayBar,
} from "@/lib/todo-store"
import { readTheme, writeTheme } from "@/lib/idb"
import { repo } from "@/lib/repo"

export type Filter = "all" | "active" | "done" | "overdue"

export function useTodoState() {
  const todos = useSyncExternalStore(repo.subscribe, repo.getSnapshot, repo.getServerSnapshot)
  const [filter, setFilter] = useState<Filter>("all")
  const [activeDate, setActiveDate] = useState("")
  const [mounted, setMounted] = useState(false)
  const [dark, setDark] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [slideDir, setSlideDir] = useState<1 | -1>(1)

  // If the reader was on "today" when the tab went to sleep, follow today forward.
  const activeDateRef = useRef("")
  const lastTodayRef = useRef(todayKey())
  activeDateRef.current = activeDate

  // ── Bootstrap (client-only) ─────────────────────────────────────────────────
  useEffect(() => {
    const today = todayKey()
    setActiveDate(today)

    async function init() {
      await repo.load()
      const isDark = await readTheme()
      setDark(isDark)
      document.documentElement.classList.toggle("dark", isDark)
      setMounted(true)
    }

    init()

    // Crossing midnight while the tab sits open (or in the background).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      repo.checkDay()
      if (todayKey() !== activeDateRef.current && activeDateRef.current === lastTodayRef.current) {
        setActiveDate(todayKey())
      }
      lastTodayRef.current = todayKey()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  // ── Theme ───────────────────────────────────────────────────────────────────
  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    writeTheme(next)
  }

  // ── Date navigation ─────────────────────────────────────────────────────────
  const navigate = (dir: 1 | -1) => {
    setSlideDir(dir)
    setActiveDate((d) => addDays(d, dir))
    setFilter("all")
  }

  const goToday = () => {
    setSlideDir(activeDate < todayKey() ? 1 : -1)
    setActiveDate(todayKey())
    setFilter("all")
  }

  const selectDay = (dateKey: string) => {
    setSlideDir(dateKey > activeDate ? 1 : -1)
    setActiveDate(dateKey)
    setFilter("all")
  }

  // ── Task operations ─────────────────────────────────────────────────────────
  const addTodo = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || readOnly) return false
    repo.add(trimmed, activeDate)
    return true
  }

  const toggleTodo = (id: string) => repo.toggle(id)

  const deleteTodo = (id: string) => repo.remove([id])

  const clearCompleted = () => {
    repo.remove(todos.filter((t) => t.date === activeDate && t.completed).map((t) => t.id))
  }

  const bulkImport = (lines: string[], targetDate: string): number => {
    const trimmed = lines.map((l) => l.trim()).filter(Boolean)
    if (!trimmed.length) return 0
    return repo.addMany(trimmed, targetDate)
  }

  // ── Derived flags ───────────────────────────────────────────────────────────
  const readOnly = Boolean(activeDate) && isPast(activeDate) && !isToday(activeDate)
  const isFuture = Boolean(activeDate) && activeDate > todayKey()

  // ── Derived data (memoised) ─────────────────────────────────────────────────
  const dayTodos = useMemo(
    () => (activeDate ? todosForDate(todos, activeDate) : []),
    [todos, activeDate]
  )

  const filteredTodos = useMemo(
    () =>
      dayTodos
        .filter((t) => {
          if (filter === "active") return !t.completed
          if (filter === "done") return t.completed
          if (filter === "overdue") return !t.completed && t.rolloverCount > 1
          return true
        })
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1
          return a.createdAt - b.createdAt
        }),
    [dayTodos, filter]
  )

  const activeCount = useMemo(() => dayTodos.filter((t) => !t.completed).length, [dayTodos])
  const completedCount = useMemo(() => dayTodos.filter((t) => t.completed).length, [dayTodos])

  const streak = useMemo(
    () => (activeDate ? computeStreak(todos) : 0),
    [todos, activeDate]
  )

  const rolloverDebt = useMemo(
    () => (activeDate ? computeRolloverDebt(todos) : 0),
    [todos, activeDate]
  )

  const summary = useMemo(
    () =>
      activeDate
        ? dailySummary(todos, activeDate)
        : { total: 0, completed: 0, rolledIn: 0, completionPct: 0 },
    [todos, activeDate]
  )

  const week = useMemo(
    () => (activeDate ? weekSummary(todos, activeDate) : []),
    [todos, activeDate]
  )

  const history = useMemo(
    () => (activeDate ? last30Days(todos) : []),
    [todos, activeDate]
  )

  const dateLabel = useMemo(
    () =>
      activeDate
        ? new Date(activeDate + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "",
    [activeDate]
  )

  const emptyText = useMemo(() => {
    if (filter === "done") return "No victories yet — but the day is young"
    if (filter === "active") return "Nothing to do. Suspicious."
    if (filter === "overdue") return "Clean slate. Procrastination: 0."
    if (readOnly) return "This day left no trace"
    if (isFuture) return "Future you will thank present you"
    return "Suspiciously empty in here"
  }, [filter, readOnly, isFuture])

  return {
    // State
    filter, setFilter,
    activeDate,
    mounted,
    dark,
    summaryOpen, setSummaryOpen,
    slideDir,
    // Flags
    readOnly,
    isFuture,
    // Derived
    dayTodos,
    filteredTodos,
    activeCount,
    completedCount,
    streak,
    rolloverDebt,
    summary,
    week,
    history,
    dateLabel,
    emptyText,
    // Actions
    toggleTheme,
    navigate,
    goToday,
    selectDay,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    bulkImport,
  }
}
