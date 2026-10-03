"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Check, Undo2, X, RefreshCw } from "lucide-react"
import type { Todo } from "@/lib/todo-store"

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  readOnly?: boolean
}

export function TodoItem({ todo, onToggle, onDelete, readOnly = false }: TodoItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => !readOnly && onToggle(todo.id)}
      className={`group flex items-center justify-between py-3.5 select-none ${readOnly ? "cursor-default" : "cursor-pointer"}`}
    >
      {/* Text + rollover badge */}
      <span className="flex-1 text-lg leading-relaxed select-none pr-4 flex items-center gap-2.5">
        <span className="relative inline-block leading-none">
          <motion.span
            initial={false}
            animate={{ opacity: todo.completed ? 0.3 : 0.8 }}
            transition={{ duration: 0.2 }}
          >
            {todo.text}
          </motion.span>

          {/* Strikethrough */}
          <motion.span
            initial={false}
            animate={{ scaleX: todo.completed ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 38, delay: todo.completed ? 0.05 : 0 }}
            style={{ top: "50%", transform: "translateY(-50%)", originX: 0 }}
            aria-hidden
            className="absolute left-0 right-0 h-px bg-foreground/35 pointer-events-none"
          />
        </span>

        {/* Rollover badge */}
        {todo.rolloverCount > 0 && !todo.completed && (
          <span className="inline-flex items-center gap-1 text-[11px] text-foreground/30 shrink-0">
            <RefreshCw className="w-2.5 h-2.5" />
            {todo.rolloverCount > 1 ? `${todo.rolloverCount}d` : ""}
          </span>
        )}
      </span>

      {/* Right side icons — hidden on read-only past days */}
      {!readOnly && (
        <span className="flex items-center gap-2 shrink-0 mr-3">
          <AnimatedIcon show={hovered} completed={todo.completed} />
          <motion.button
            initial={false}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(todo.id)
            }}
            aria-label="Delete task"
            tabIndex={-1}
            className="text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </span>
      )}
    </motion.li>
  )
}

function AnimatedIcon({ show, completed }: { show: boolean; completed: boolean }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.15 }}
      aria-hidden
      className="text-foreground/35"
    >
      {completed ? <Undo2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
    </motion.span>
  )
}
