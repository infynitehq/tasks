"use client"

import { motion } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { WeekDay } from "@/lib/todo-store"
import { addDays, todayKey } from "@/lib/todo-store"

interface WeeklyStripProps {
  week: WeekDay[]
  activeDate: string
  onSelectDay: (dateKey: string) => void
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

export function WeeklyStrip({ week, activeDate, onSelectDay }: WeeklyStripProps) {
  const today = todayKey()

  // Navigate the active date by a whole week
  const shiftWeek = (dir: -1 | 1) => {
    onSelectDay(addDays(activeDate, dir * 7))
  }

  // Is the displayed week the one containing today?
  const isCurrentWeek = week.some((d) => d.isToday)

  return (
    <div data-tour-region="week" className="mb-10 overflow-hidden">
      {/* Week prev/next controls */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
          className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="text-[10px] uppercase tracking-widest text-foreground/25 select-none">
          {isCurrentWeek
            ? "This week"
            : week[0]
            ? new Date(week[0].dateKey + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
              " — " +
              new Date(week[6].dateKey + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : ""}
        </span>

        <button
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
          disabled={isCurrentWeek}
          className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day columns */}
      <div className="flex gap-1">
        {week.map((day, i) => {
          const isActive = day.dateKey === activeDate
          const isFuture = day.dateKey > today
          const hasData = day.total > 0

          return (
            <button
              key={day.dateKey}
              onClick={() => onSelectDay(day.dateKey)}
              aria-label={day.dateKey}
              aria-pressed={isActive}
              className="flex-1 min-w-0 flex flex-col items-center gap-1.5 focus-visible:outline-none group"
            >
              {/* Completion bar */}
              <div className="w-full h-[3px] rounded-full bg-foreground/8 overflow-hidden">
                {hasData && !isFuture && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: day.completionPct / 100 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30, delay: i * 0.04 }}
                    style={{ originX: 0 }}
                    className={`h-full rounded-full ${
                      day.completionPct === 100 ? "bg-foreground/50" : "bg-foreground/25"
                    }`}
                  />
                )}
              </div>

              {/* Day number */}
              <span
                className={`text-[11px] font-medium transition-colors duration-150 ${
                  isActive
                    ? "text-foreground/80"
                    : isFuture
                    ? "text-foreground/20"
                    : "text-foreground/35 group-hover:text-foreground/55"
                }`}
              >
                {new Date(day.dateKey + "T00:00:00").getDate()}
              </span>

              {/* Day label */}
              <span
                className={`text-[10px] uppercase tracking-widest transition-colors duration-150 ${
                  isActive ? "text-foreground/50" : "text-foreground/20"
                }`}
              >
                {DAY_LABELS[i]}
              </span>

              {/* Active dot */}
              <div
                className={`w-1 h-1 rounded-full transition-all duration-200 ${
                  isActive ? "bg-foreground/50" : "bg-transparent"
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
