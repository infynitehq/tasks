"use client"

import { motion, AnimatePresence } from "motion/react"
import { Trash2, BarChart2, ListPlus } from "lucide-react"
import type { Filter } from "@/hooks/use-todo-state"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
]

interface FilterBarProps {
  filter: Filter
  onFilter: (f: Filter) => void
  completedCount: number
  readOnly: boolean
  onClear: () => void
  onSummary: () => void
  onImport: () => void
}

export function FilterBar({
  filter,
  onFilter,
  completedCount,
  readOnly,
  onClear,
  onSummary,
  onImport,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-6 mb-8">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilter(key)}
          className="relative focus-visible:outline-none"
        >
          <span
            className={`text-base transition-colors duration-150 ${
              filter === key
                ? "text-foreground/80"
                : "text-foreground/30 hover:text-foreground/55"
            }`}
          >
            {label}
          </span>
          {filter === key && (
            <motion.span
              layoutId="filter-underline"
              className="absolute -bottom-0.5 left-0 right-0 h-px bg-foreground/50"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {!readOnly && (
          <button
            onClick={onImport}
            aria-label="Bulk import tasks"
            className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none"
          >
            <ListPlus className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onSummary}
          aria-label="Open summary"
          className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none"
        >
          <BarChart2 className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {completedCount > 0 && !readOnly && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClear}
              aria-label={`Clear ${completedCount} completed`}
              className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
