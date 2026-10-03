"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames, type DayButton, type Locale } from "react-day-picker"
import { motion, AnimatePresence } from "motion/react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────────────────

type View = "days" | "months" | "years"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

// ─── Enhanced Calendar ────────────────────────────────────────────────────────

function Calendar({
  className,
  classNames,
  selected,
  onSelect,
  locale,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const today = new Date()

  // Controlled display month
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => {
    if (selected instanceof Date) return new Date(selected.getFullYear(), selected.getMonth(), 1)
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  // Keep displayMonth in sync when selected changes externally
  React.useEffect(() => {
    if (selected instanceof Date) {
      setDisplayMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
    }
  }, [selected])

  const [view, setView] = React.useState<View>("days")
  const [dir, setDir] = React.useState(1)

  // Year grid — show decade window centred on displayMonth year
  const baseYear = Math.floor(displayMonth.getFullYear() / 12) * 12
  const years = Array.from({ length: 12 }, (_, i) => baseYear + i)

  // ── Nav helpers ──────────────────────────────────────────────────────────────

  function stepMonth(delta: number) {
    setDir(delta)
    setDisplayMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  function stepYear(delta: number) {
    setDir(delta)
    setDisplayMonth((m) => new Date(m.getFullYear() + delta, m.getMonth(), 1))
  }

  function stepDecade(delta: number) {
    setDir(delta)
    setDisplayMonth((m) => new Date(m.getFullYear() + delta * 12, m.getMonth(), 1))
  }

  function pickMonth(month: number) {
    setDir(1)
    setDisplayMonth(new Date(displayMonth.getFullYear(), month, 1))
    setView("days")
  }

  function pickYear(year: number) {
    setDir(1)
    setDisplayMonth(new Date(year, displayMonth.getMonth(), 1))
    setView("months")
  }

  function cycleView() {
    setDir(1)
    setView((v) => (v === "days" ? "months" : v === "months" ? "years" : "days"))
  }

  // ── Caption label ────────────────────────────────────────────────────────────

  const captionLabel =
    view === "years"
      ? `${baseYear} – ${baseYear + 11}`
      : view === "months"
      ? `${displayMonth.getFullYear()}`
      : displayMonth.toLocaleString(locale?.code, { month: "long", year: "numeric" })

  // ── Nav arrows based on view ────────────────────────────────────────────────

  const onPrev = view === "days" ? () => stepMonth(-1) : view === "months" ? () => stepYear(-1) : () => stepDecade(-1)
  const onNext = view === "days" ? () => stepMonth(1) : view === "months" ? () => stepYear(1) : () => stepDecade(1)

  // ── Shared motion props ──────────────────────────────────────────────────────

  const motionKey = view === "days"
    ? `${displayMonth.getFullYear()}-${displayMonth.getMonth()}`
    : view === "months"
    ? `months-${displayMonth.getFullYear()}`
    : `years-${baseYear}`

  const defaultClassNames = getDefaultClassNames()

  return (
    <div className={cn("w-[280px] bg-background rounded-xl p-3 select-none", className)}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 h-8">
        <button
          onClick={onPrev}
          className="flex items-center justify-center size-7 rounded-md text-foreground/40 hover:text-foreground/80 hover:bg-foreground/5 transition-colors focus-visible:outline-none"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <button
          onClick={cycleView}
          className="flex items-center px-2 py-1 rounded-md text-sm font-medium text-foreground/80 transition-colors focus-visible:outline-none"
        >
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.span
              key={captionLabel}
              custom={dir}
              variants={VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="block"
            >
              {captionLabel}
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          onClick={onNext}
          className="flex items-center justify-center size-7 rounded-md text-foreground/40 hover:text-foreground/80 hover:bg-foreground/5 transition-colors focus-visible:outline-none"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      {/* ── Views ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={motionKey}
            custom={dir}
            variants={VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* Days view */}
            {view === "days" && (
              <DayPicker
                {...props}
                selected={selected}
                onSelect={onSelect}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                showOutsideDays
                locale={locale}
                classNames={{
                  months: "flex flex-col",
                  month: "flex flex-col gap-3",
                  month_caption: "hidden",
                  nav: "hidden",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday: "flex-1 text-[11px] font-normal text-foreground/25 text-center pb-1.5",
                  week: "flex w-full",
                  day: cn(
                    "group/day relative aspect-square w-full p-0 text-center",
                    defaultClassNames.day
                  ),
                  today: "rounded-md bg-foreground/[0.06] text-foreground",
                  outside: "text-foreground/20 aria-selected:text-primary-foreground",
                  disabled: "text-foreground/15 opacity-50",
                  hidden: "invisible",
                  ...classNames,
                }}
                components={{
                  DayButton: ({ ...p }) => <CalendarDayButton locale={locale} {...p} />,
                  ...components,
                }}
              />
            )}

            {/* Months view */}
            {view === "months" && (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {MONTHS.map((name, i) => {
                  const isSelected =
                    selected instanceof Date &&
                    selected.getMonth() === i &&
                    selected.getFullYear() === displayMonth.getFullYear()
                  const isThisMonth =
                    today.getMonth() === i && today.getFullYear() === displayMonth.getFullYear()
                  return (
                    <button
                      key={name}
                      onClick={() => pickMonth(i)}
                      className={cn(
                        "rounded-lg py-2 text-sm transition-colors duration-150 focus-visible:outline-none",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : isThisMonth
                          ? "bg-foreground/[0.06] text-foreground font-medium"
                          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Years view */}
            {view === "years" && (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {years.map((year) => {
                  const isSelected =
                    selected instanceof Date && selected.getFullYear() === year
                  const isThisYear = today.getFullYear() === year
                  return (
                    <button
                      key={year}
                      onClick={() => pickYear(year)}
                      className={cn(
                        "rounded-lg py-2 text-sm transition-colors duration-150 focus-visible:outline-none",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : isThisYear
                          ? "bg-foreground/[0.06] text-foreground font-medium"
                          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {year}
                    </button>
                  )
                })}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Day button ───────────────────────────────────────────────────────────────

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      data-selected-single={
        modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
      }
      className={cn(
        "relative isolate flex aspect-square w-full min-w-[28px] items-center justify-center rounded-md text-sm leading-none transition-colors duration-100 focus-visible:outline-none",
        "hover:bg-foreground/5 hover:text-foreground",
        modifiers.selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        modifiers.today && !modifiers.selected && "font-semibold",
        modifiers.outside && !modifiers.selected && "text-foreground/20",
        modifiers.disabled && "opacity-30 pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
