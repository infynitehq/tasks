"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { RadialBarChart, RadialBar, PolarGrid, PolarRadiusAxis, Label } from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { DailySummary, DayBar } from "@/lib/todo-store"

interface SummaryPanelProps {
  open: boolean
  onClose: () => void
  summary: DailySummary
  streak: number
  rolloverDebt: number
  onFilterOverdue: () => void
  dateLabel: string
  history: DayBar[]
}

// ─── Radial bar ring ──────────────────────────────────────────────────────────

const ringConfig = {
  value: { label: "Done", color: "var(--primary)" },
} satisfies ChartConfig

function CompletionRing({ pct, completed, total }: { pct: number; completed: number; total: number }) {
  const data = [{ value: Math.max(pct, 0.5) }]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <ChartContainer config={ringConfig} className="mx-auto aspect-square w-[160px]">
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={90 - pct * 3.6}
          outerRadius={70}
          innerRadius={54}
        >
          {/* Track: two concentric circles drawn as the PolarGrid, filled with explicit colours */}
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            polarRadius={[70, 54]}
          />
          <RadialBar
            dataKey="value"
            background={{ fill: "var(--foreground)", opacity: 0.08, cornerRadius: 6 }}
            cornerRadius={6}
            fill="var(--primary)"
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        fill="var(--foreground)"
                        fontSize={26}
                        fontWeight={600}
                      >
                        {pct}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        fill="var(--foreground)"
                        fillOpacity={0.35}
                        fontSize={10}
                      >
                        {completed}/{total} done
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </motion.div>
  )
}

// ─── Flexbox bar chart ────────────────────────────────────────────────────────

const TRACK_H = 52

function ActivityBars({ data }: { data: DayBar[] }) {
  const max = Math.max(...data.map((d) => d.completed), 1)
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => {
        const h = d.completed === 0 ? 0 : Math.max((d.completed / max) * TRACK_H, 4)
        return (
          <div key={d.dateKey} className="flex-1 flex flex-col items-center gap-2.5">
            {/* Faint track keeps the chart legible even on empty days */}
            <div
              className="w-full relative rounded-[3px] bg-foreground/[0.05] overflow-hidden"
              style={{ height: TRACK_H }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.55, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute bottom-0 left-0 right-0 rounded-[3px] ${
                  d.isToday ? "bg-primary" : "bg-foreground/25"
                }`}
              />
            </div>
            <span
              className={`text-[10px] tabular-nums ${
                d.isToday ? "text-primary font-medium" : "text-foreground/25"
              }`}
            >
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function SummaryPanel({
  open,
  onClose,
  summary,
  streak,
  rolloverDebt,
  onFilterOverdue,
  dateLabel,
  history,
}: SummaryPanelProps) {
  const chartData = useMemo(() => history.slice(-14), [history])
  const totalEver = useMemo(() => history.reduce((s, d) => s + d.total, 0), [history])
  const doneEver = useMemo(() => history.reduce((s, d) => s + d.completed, 0), [history])
  const tiles = [
    { label: "Streak", value: streak, sub: "days", accent: streak > 0 },
    { label: "Completion", value: totalEver === 0 ? "—" : `${Math.round((doneEver / totalEver) * 100)}%`, sub: "30 days" },
    { label: "Completed", value: doneEver, sub: "tasks" },
    { label: "Carried in", value: summary.rolledIn, sub: "today" },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="summary-screen"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 500, damping: 42 }}
          className="fixed inset-0 z-50 bg-background flex justify-center overflow-hidden"
        >
          {/* Full-height column, scrolls only if truly needed (large content + small device) */}
          <div className="w-full max-w-md flex flex-col h-full px-5 pt-12 pb-6 overflow-y-auto">

            {/* Back */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none mb-6 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            {/* Hero — date + status, ring centred */}
            <div className="flex flex-col items-center text-center flex-shrink-0 mb-6">
              <p className="text-[11px] font-medium tracking-widest uppercase text-foreground/25 mb-1">
                {dateLabel}
              </p>
              <h1 className="text-xl font-medium tracking-tight text-foreground/80 mb-4">
                {summary.total === 0 ? "Nothing planned" : summary.completionPct === 100 ? "All done" : "In progress"}
              </h1>
              <CompletionRing pct={summary.completionPct} completed={summary.completed} total={summary.total} />
            </div>

            {/* Metric tiles — 2×2, compact */}
            <div className="grid grid-cols-2 flex-shrink-0 mb-6">
              {tiles.map(({ label, value, sub, accent }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.06 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className={`pt-3.5 pb-4 flex flex-col gap-1.5 border-t border-foreground/[0.08] ${i % 2 === 0 ? "pr-6" : "pl-2"}`}
                >
                  <span className="text-[10px] tracking-widest uppercase text-foreground/25">
                    {label}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-medium tabular-nums tracking-tight ${accent ? "text-primary" : "text-foreground/80"}`}>
                      {value}
                    </span>
                    <span className="text-[11px] text-foreground/25">{sub}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Activity — flex-1 so it fills remaining space; bars scale to fit */}
            <div className="flex-1 min-h-0 flex flex-col">
              <p className="text-[10px] font-medium tracking-widest uppercase text-foreground/25 mb-3 flex-shrink-0">
                14-day activity
              </p>
              <div className="flex-1 min-h-0">
                <ActivityBars data={chartData} />
              </div>
            </div>

            {/* Overdue debt */}
            {rolloverDebt > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { onFilterOverdue(); onClose() }}
                className="w-full flex items-center justify-between focus-visible:outline-none group mt-4 flex-shrink-0"
              >
                <span className="flex items-center gap-2 text-sm text-primary/80">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {rolloverDebt} task{rolloverDebt !== 1 ? "s" : ""} carried 2+ days
                </span>
                <span className="text-xs text-foreground/30 group-hover:text-foreground/60 transition-colors">View →</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
