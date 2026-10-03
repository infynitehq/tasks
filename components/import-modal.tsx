"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { todayKey } from "@/lib/todo-store"

interface ImportScreenProps {
  open: boolean
  onClose: () => void
  activeDate: string
  onImport: (lines: string[], targetDate: string) => number
}

type DateTarget = "active" | "today" | "pick"

export function ImportModal({ open, onClose, activeDate, onImport }: ImportScreenProps) {
  const [text, setText] = useState("")
  const [dateTarget, setDateTarget] = useState<DateTarget>("active")
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined)
  const [calOpen, setCalOpen] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 120)
      setResult(null)
      setText("")
      setDateTarget("active")
      setPickedDate(undefined)
      setCalOpen(false)
    }
  }, [open])

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const preview = lines.length

  const resolvedDate = () => {
    if (dateTarget === "today") return todayKey()
    if (dateTarget === "pick") return pickedDate ? format(pickedDate, "yyyy-MM-dd") : todayKey()
    return activeDate
  }

  const targetLabel = () => {
    const d = new Date(resolvedDate() + "T00:00:00")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const handleImport = () => {
    if (!lines.length) return
    const added = onImport(lines, resolvedDate())
    setResult(added)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="import-screen"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 500, damping: 42 }}
          className="fixed inset-0 z-50 bg-background overflow-y-auto flex justify-center"
        >
          {/* Mirrors page.tsx: flex justify-center + same padding/max-width */}
          <div className="w-full max-w-md px-4 pt-20 pb-16">

            {/* Back button — same top bar position as theme toggle */}
            <div className="flex justify-start mb-12">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>
            </div>

            {/* Heading — same rhythm as "Tasks" title */}
            <h1 className="text-4xl font-medium tracking-tight text-foreground/85 mb-1">
              Import
            </h1>
            <p className="text-sm text-foreground/30 mb-10">
              One task per line. Duplicates are skipped.
            </p>

            {/* Textarea */}
            <div className="mb-8">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => { setText(e.target.value); setResult(null) }}
                placeholder={"Buy groceries\nCall the dentist\nFinish the report"}
                rows={8}
                className="w-full bg-transparent border-b border-foreground/15 pb-3 text-lg text-foreground/80 placeholder:text-foreground/20 focus:outline-none resize-none leading-relaxed transition-colors duration-150 focus:border-foreground/35"
              />
              <AnimatePresence mode="wait">
                {preview > 0 && result === null && (
                  <motion.p
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-foreground/30 mt-2"
                  >
                    {preview} task{preview !== 1 ? "s" : ""} ready
                  </motion.p>
                )}
                {result !== null && (
                  <motion.p
                    key="result"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-foreground/45 mt-2"
                  >
                    {result === 0
                      ? "No new tasks — all already exist on that day"
                      : `${result} task${result !== 1 ? "s" : ""} added to ${targetLabel()}`}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Date target */}
            <div className="mb-10">
              <p className="text-xs text-foreground/30 mb-3 tracking-wide uppercase">Import to</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: "active" as DateTarget, label: "This day" },
                  { key: "today" as DateTarget, label: "Today" },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDateTarget(key)}
                    className={`text-sm px-4 py-1.5 rounded-full border transition-colors duration-150 focus-visible:outline-none ${
                      dateTarget === key
                        ? "border-foreground/40 text-foreground/75 bg-foreground/5"
                        : "border-foreground/10 text-foreground/35 hover:border-foreground/20 hover:text-foreground/55"
                    }`}
                  >
                    {label}
                  </button>
                ))}

                {/* Pick date pill — shows selected date inline */}
                <button
                  onClick={() => { setDateTarget("pick"); setCalOpen(true) }}
                  className={`text-sm px-4 py-1.5 rounded-full border transition-colors duration-150 focus-visible:outline-none ${
                    dateTarget === "pick"
                      ? "border-foreground/40 text-foreground/75 bg-foreground/5"
                      : "border-foreground/10 text-foreground/35 hover:border-foreground/20 hover:text-foreground/55"
                  }`}
                >
                  {dateTarget === "pick" && pickedDate
                    ? format(pickedDate, "MMM d, yyyy")
                    : "Pick date"}
                </button>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={result !== null ? onClose : handleImport}
              disabled={preview === 0 && result === null}
              className="w-full py-3.5 rounded-full bg-foreground/85 text-background text-sm font-medium hover:bg-foreground/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none"
            >
              {result !== null
                ? "Done"
                : preview > 0
                ? `Import ${preview} task${preview !== 1 ? "s" : ""}`
                : "Import tasks"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Full-screen calendar — slides in over the import screen */}
      <AnimatePresence>
        {open && calOpen && (
          <motion.div
            key="cal-screen"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            className="fixed inset-0 z-60 bg-background flex justify-center"
          >
            <div className="w-full max-w-md px-6 h-full flex flex-col items-center justify-center gap-6">
              <Calendar
                mode="single"
                selected={pickedDate}
                onSelect={(d) => {
                  setPickedDate(d)
                  setDateTarget("pick")
                  setCalOpen(false)
                }}
                autoFocus
                className="border-none p-0"
              />
              <button
                onClick={() => setCalOpen(false)}
                className="w-full py-3.5 rounded-full bg-foreground/85 text-background text-sm font-medium hover:bg-foreground/70 transition-colors duration-150 focus-visible:outline-none"
              >
                Go back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
