"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Sun, Moon, RefreshCw } from "lucide-react"
import { useSync } from "@/hooks/use-sync"
import { sync } from "@/lib/sync/manager"
import { SyncSheet } from "./sync-sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTodoState } from "@/hooks/use-todo-state"
import { TodoItem } from "./todo-item"
import { WeeklyStrip } from "./weekly-strip"
import { DateNav } from "./date-nav"
import { FilterBar } from "./filter-bar"
import { SummaryPanel } from "./summary-panel"
import { ImportModal } from "./import-modal"

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
    isFuture,
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
    goToday,
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
  const syncState = useSync()

  // Start sync once, and open the sync screen if we arrived via a pairing link.
  useEffect(() => {
    void sync.init().then(() => {
      if (sync.consumePairLink()) setSyncOpen(true)
    })
    const onHash = () => {
      if (sync.consumePairLink()) setSyncOpen(true)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const handleAdd = () => {
    const ok = addTodo(localInput)
    if (ok) setLocalInput("")
  }

  if (!mounted) return null

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col pt-8 pb-4">

      {/* Top bar */}
      <div className="flex justify-end items-center gap-4 mb-4 flex-shrink-0">
        <button
          onClick={() => {
            setSyncOpen(true)
            void sync.init()
          }}
          aria-label={
            syncState.enabled
              ? `Sync: ${syncState.online.length} device${syncState.online.length === 1 ? "" : "s"} online`
              : "Sync"
          }
          className="relative text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
        >
          <RefreshCw className="w-4 h-4" />
          {syncState.enabled && (
            <span
              aria-hidden
              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                syncState.online.length ? "bg-foreground/80" : "bg-foreground/25"
              }`}
            />
          )}
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Weekly strip */}
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

        {readOnly && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={goToday}
            className="text-xs text-foreground/25 hover:text-foreground/50 transition-colors duration-150 focus-visible:outline-none tracking-wide mt-1"
          >
            today&apos;s not gonna do itself
          </motion.button>
        )}
      </motion.div>

      {/* Input */}
      {!readOnly && (
        <div className="border-b border-foreground/10 mb-4 flex-shrink-0">
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
                className="py-12 text-center select-none"
              >
                <span className="text-sm text-foreground/25">{emptyText}</span>
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
