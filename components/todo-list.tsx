"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Sun, Moon, CircleHelp, CodeXml } from "lucide-react"
import { getMeta, setMeta } from "@/lib/idb"
import { todayKey } from "@/lib/todo-store"
import { GuidedTour } from "./guided-tour"
import { WelcomeScreen } from "./welcome-screen"
import { OnboardingAvatar } from "./onboarding-avatar"
import { useSync } from "@/hooks/use-sync"
import { sync } from "@/lib/sync/manager"
import { SyncSheet } from "./sync-sheet"
import { SyncStatusButton } from "./sync-status"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTodoState } from "@/hooks/use-todo-state"
import { TodoItem } from "./todo-item"
import { WeeklyStrip } from "./weekly-strip"
import { DateNav } from "./date-nav"
import { FilterBar } from "./filter-bar"
import { SummaryPanel } from "./summary-panel"
import { ImportModal } from "./import-modal"
import { AboutScreen } from "./about-screen"

export function TodoList() {
  const {
    // State
    filter, setFilter,
    activeDate,
    mounted,
    dark,
    summaryOpen, setSummaryOpen,
    slideDir,
    // Flags
    readOnly,
    // Derived
    filteredTodos,
    activeCount,
    completedCount,
    dayTodos,
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
    selectDay,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    bulkImport,
  } = useTodoState()

  const [localInput, setLocalInput] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const [autoTour, setAutoTour] = useState(false)
  const [pairingArrival, setPairingArrival] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const syncState = useSync()

  // Start sync once, and open the sync screen if we arrived via a pairing link.
  useEffect(() => {
    void sync.init().then(() => {
      if (sync.consumePairLink()) {
        setSyncOpen(true)
        setPairingArrival(true)
        setTourOpen(false)
        setWelcomeOpen(false)
      }
      setSyncReady(true)
    })
    const onHash = () => {
      if (sync.consumePairLink()) {
        setSyncOpen(true)
        setPairingArrival(true)
        setTourOpen(false)
        setWelcomeOpen(false)
      }
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  useEffect(() => {
    let cancelled = false
    void getMeta<boolean>("onboarding-v1").then((seen) => {
      if (!cancelled) setAutoTour(!seen)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (mounted && syncReady && autoTour && !pairingArrival && !syncOpen && !importOpen && !summaryOpen) {
      setWelcomeOpen(true)
      setAutoTour(false)
    }
  }, [mounted, syncReady, autoTour, pairingArrival, syncOpen, importOpen, summaryOpen])

  const finishTour = () => {
    setWelcomeOpen(false)
    setTourOpen(false)
    setAutoTour(false)
    void setMeta("onboarding-v1", true)
  }

  const replayTour = () => {
    if (readOnly) selectDay(todayKey())
    setAutoTour(false)
    setWelcomeOpen(false)
    setTourOpen(true)
  }

  const startWelcomeTour = () => {
    setWelcomeOpen(false)
    setTourOpen(true)
  }

  const handleAdd = () => {
    const ok = addTodo(localInput)
    if (ok) setLocalInput("")
  }

  if (!mounted) return null

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col pt-8 pb-4">

      {/* Top bar */}
      <div className="flex justify-between items-center gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About the app and developer"
            aria-haspopup="dialog"
            title="About the app and developer"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/40 hover:text-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            <CodeXml aria-hidden="true" className="w-4 h-4" />
          </button>
          <button
            onClick={replayTour}
            aria-label="Replay tour"
            title="Replay tour"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/40 hover:text-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            <CircleHelp className="w-4 h-4" />
          </button>
        </div>
        <div data-tour="preferences" className="flex items-center gap-4">
          <SyncStatusButton
            state={syncState}
            onClick={() => {
              setSyncOpen(true)
              void sync.init()
            }}
          />
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Weekly strip */}
      <div data-tour="dates" className="flex-shrink-0">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex-shrink-0">
          <WeeklyStrip week={week} activeDate={activeDate} onSelectDay={selectDay} />
        </motion.div>

        {/* Date navigation */}
        <DateNav
          dateLabel={dateLabel}
          activeDate={activeDate}
          slideDir={slideDir}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
        />
      </div>

      {/* Title + counter */}
      <motion.div
        className="mb-4 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="text-2xl font-medium tracking-tight text-foreground/85">Tasks</h1>

        <AnimatePresence mode="wait">
          <motion.p
            key={`${activeDate}-${activeCount}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            className="text-xs text-foreground/25 mt-1.5"
          >
            {readOnly
              ? `${completedCount} of ${dayTodos.length} completed`
              : activeCount === 0 && dayTodos.length > 0
              ? "all done"
              : activeCount > 0
              ? `${activeCount} remaining`
              : ""}
          </motion.p>
        </AnimatePresence>

      </motion.div>

      {/* Input */}
      {!readOnly && (
        <div data-tour="entry" className="border-b border-foreground/10 mb-4 flex-shrink-0">
          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && !(e.keyCode === 229))
                handleAdd()
            }}
            placeholder="Add a task"
            className="w-full py-2.5 bg-transparent text-base placeholder:text-foreground/25 text-foreground/80 focus:outline-none select-none"
          />
        </div>
      )}

      {/* Filter bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex-shrink-0">
        <FilterBar
          filter={filter}
          onFilter={setFilter}
          completedCount={completedCount}
          readOnly={readOnly}
          onClear={clearCompleted}
          onSummary={() => setSummaryOpen(true)}
          onImport={() => setImportOpen(true)}
        />
      </motion.div>

      {/* Task list */}
      <ScrollArea className="flex-1 min-h-0">
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {filteredTodos.length === 0 && (
              <motion.li
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-3 px-4 py-10 text-center select-none"
              >
                <OnboardingAvatar size={96} dark={dark} mood={filter === "active" || filter === "overdue" ? "happy" : "neutral"} />
                <span className="text-sm leading-relaxed text-foreground/45 dark:text-foreground/65">{emptyText}</span>
              </motion.li>
            )}
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                readOnly={readOnly}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      </ScrollArea>

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        activeDate={activeDate}
        onImport={bulkImport}
      />

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
      <AboutScreen open={aboutOpen} dark={dark} onClose={() => setAboutOpen(false)} />

      <WelcomeScreen open={welcomeOpen && !syncOpen && !importOpen && !summaryOpen} dark={dark} onStartTour={startWelcomeTour} onSkip={finishTour} />
      <GuidedTour open={tourOpen && !syncOpen && !importOpen && !summaryOpen} dark={dark} onFinish={finishTour} />

      {/* Summary panel */}
      <SummaryPanel
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        summary={summary}
        streak={streak}
        rolloverDebt={rolloverDebt}
        onFilterOverdue={() => setFilter("overdue")}
        dateLabel={dateLabel}
        history={history}
      />
    </div>
  )
}
