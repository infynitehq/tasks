"use client"

import { Check, CircleCheckBig, CircleAlert, Laptop, RefreshCw, Smartphone } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { syncSummary, type SyncStatusKind } from "@/lib/sync/status"
import type { SyncState } from "@/lib/sync/manager"

export function SyncStatusIcon({ kind, className = "h-4 w-4" }: { kind: SyncStatusKind; className?: string }) {
  const Icon = kind === "synced" ? Check : kind === "error" ? CircleAlert
    : kind === "waiting" ? Smartphone : kind === "setup" ? Laptop : RefreshCw
  return <Icon aria-hidden="true" className={`${className} ${kind === "syncing" || kind === "connecting" ? "motion-safe:animate-spin" : ""}`} />
}

export function SyncStatusButton({ state, onClick }: { state: SyncState; onClick: () => void }) {
  const status = syncSummary(state)
  const reducedMotion = useReducedMotion()
  return (
    <button
      onClick={onClick}
      aria-label={`${status.label}. Open device sync`}
      title={status.label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/40 hover:text-foreground/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={status.kind}
          aria-hidden="true"
          className="flex"
          initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.85 }}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
        >
          {status.kind === "synced" ? <CircleCheckBig aria-hidden="true" className="h-4 w-4" /> : <SyncStatusIcon kind={status.kind} />}
        </motion.span>
      </AnimatePresence>
      <span role="status" className="sr-only">{status.label}</span>
    </button>
  )
}
