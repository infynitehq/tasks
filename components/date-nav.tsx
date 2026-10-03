"use client"

import { motion, AnimatePresence } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DateNavProps {
  dateLabel: string
  activeDate: string
  slideDir: 1 | -1
  onPrev: () => void
  onNext: () => void
}

export function DateNav({ dateLabel, activeDate, slideDir, onPrev, onNext }: DateNavProps) {
  return (
    <div data-tour-region="day" className="flex items-center justify-between mb-2">
      <button
        onClick={onPrev}
        aria-label="Previous day"
        className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none p-1 -ml-1"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeDate}
          initial={{ opacity: 0, x: slideDir * 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: slideDir * -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex-1 text-center"
        >
          <p className="text-xs font-medium tracking-widest uppercase text-foreground/30">
            {dateLabel}
          </p>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={onNext}
        aria-label="Next day"
        className="text-foreground/25 hover:text-foreground/55 transition-colors duration-150 focus-visible:outline-none p-1 -mr-1"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
