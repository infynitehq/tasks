"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft, Check, CircleCheck, Copy, Laptop, Smartphone, ShieldCheck, ArrowRight, Monitor, RefreshCw, Clock3, ScanLine, Keyboard } from "lucide-react"
import { Classic, Eclipse, Pulse } from "loading-dev"
import { useSync } from "@/hooks/use-sync"
import { sync, type SyncState, type Pairing } from "@/lib/sync/manager"
import { QrCode } from "./qr-code"
import { syncSummary } from "@/lib/sync/status"
import { SyncStatusIcon } from "./sync-status"
import { SyncIllustration } from "./sync-illustration"
import { QrPairScanner } from "./qr-pair-scanner"
import { PairingCodeEntry } from "./pairing-code-entry"
import { formatPairingCode } from "@/lib/pairing-code"
import styles from "./sync-sheet.module.css"

const primaryBtn =
  "w-full py-3.5 rounded-full bg-foreground/85 text-background text-sm font-medium hover:bg-foreground/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
const secondaryBtn =
  "w-full py-3.5 rounded-full border border-foreground/15 text-foreground/60 text-sm font-medium hover:border-foreground/30 hover:text-foreground/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const MIN_PREPARATION_MS = 1000

function usePresentedPairing(pairing: Pairing | null, open: boolean): Pairing | null {
  const deadline = useRef(0)
  const [holding, setHolding] = useState(false)
  const role = pairing?.role, stage = pairing?.stage

  useEffect(() => {
    if (!open || role !== "host" || (stage !== "starting" && stage !== "waiting")) {
      deadline.current = 0
      setHolding(false)
      return
    }
    if (stage === "starting" || deadline.current === 0) deadline.current = performance.now() + MIN_PREPARATION_MS
    const remaining = deadline.current - performance.now()
    setHolding(remaining > 0)
    if (remaining <= 0) return
    const timer = setTimeout(() => setHolding(false), remaining)
    return () => clearTimeout(timer)
  }, [open, role, stage])

  // Hold only the ready-to-scan transition, never errors, approval or cancellation.
  return open && (holding || deadline.current === 0) && pairing?.role === "host" && pairing.stage === "waiting"
    ? { ...pairing, stage: "starting" }
    : pairing
}

export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useSync()
  const [scanning, setScanning] = useState(false)
  const [enteringCode, setEnteringCode] = useState(false)
  useEffect(() => {
    if (!open || state.pairing) { setScanning(false); setEnteringCode(false) }
  }, [open, state.pairing])
  const pairing = usePresentedPairing(state.pairing, open)
  const centered = !state.ready || pairing?.stage === "starting" || pairing?.stage === "connecting"
    || (pairing?.role === "host" && (pairing.stage === "waiting" || pairing.stage === "confirm"))
    || pairing?.stage === "approve"
  const fullHeight = !scanning && !enteringCode && (centered || (state.ready && state.enabled && !state.pairing))
  const scan = () => { setEnteringCode(false); setScanning(true) }
  const enterCode = () => { setScanning(false); setEnteringCode(true) }

  const close = () => {
    // Leaving mid-pairing cancels it; leaving a finished one just clears it.
    if (state.pairing) void sync.cancelPairing()
    sync.clearError()
    setScanning(false)
    setEnteringCode(false)
    // Also invalidate in-flight code resolution when leaving the entry screen.
    if (!state.pairing) void sync.cancelPairing()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sync-screen"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 500, damping: 42 }}
          className="fixed inset-0 z-50 bg-background overflow-y-auto flex justify-center"
        >
          <div className={`w-full max-w-md px-5 pt-10 sm:pt-16 ${fullHeight ? "flex min-h-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "pb-16"}`}>
            <div className={`flex shrink-0 justify-between items-center ${centered ? "" : "mb-10"}`}>
              <button
                onClick={close}
                className="flex items-center gap-1.5 text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Your tasks</span>
              </button>
            </div>

            {!state.ready ? (
              <PendingView title="Sync" sub="Getting sync ready…" />
            ) : state.pairing && pairing ? (
              <PairingView pairing={pairing} onDone={() => void sync.cancelPairing()} onBackToTasks={close} />
            ) : scanning ? (
              <QrPairScanner onCancel={() => setScanning(false)} onEnterCode={enterCode} />
            ) : enteringCode ? (
              <PairingCodeEntry onCancel={() => setEnteringCode(false)} onScan={scan} />
            ) : state.enabled ? (
              <ConnectedView state={state} onScan={scan} onEnterCode={enterCode} />
            ) : (
              <OffView error={state.error} onScan={scan} onEnterCode={enterCode} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Not set up ───────────────────────────────────────────────────────────────

function OffView({ error, onScan, onEnterCode }: { error: string | null; onScan: () => void; onEnterCode: () => void }) {
  return (
    <>
      <SyncIllustration />
      <Heading title="Your tasks, together" sub="Pick up where you left off on your phone, tablet, or computer." />
      {error && <p className="text-sm text-foreground/50 mb-6">{error}</p>}
      <div className="mb-8 space-y-4">
        {["Show a code on one device. Enter its pairing code inside Tasks on the other, or scan its QR code.", "Approve the connection. You only do this once.", "Keep tasks open on both devices to share changes."].map((step, index) => (
          <div key={step} className="flex items-start gap-3 text-sm text-foreground/65">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-xs font-medium">{index + 1}</span>
            <p className="pt-0.5">{step}</p>
          </div>
        ))}
      </div>
      <button onClick={() => void sync.startHosting()} className={`${primaryBtn} flex items-center justify-center gap-2`}>
        Sync with another device <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <button onClick={onEnterCode} className={`${secondaryBtn} mt-3 flex items-center justify-center gap-2`}>
        <Keyboard className="h-4 w-4" aria-hidden="true" /> Enter a pairing code
      </button>
      <button onClick={onScan} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
        <ScanLine className="h-4 w-4" aria-hidden="true" /> Scan a QR code instead
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-foreground/45 mt-5 leading-relaxed text-center">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Only your paired devices can read your tasks.
      </p>
    </>
  )
}

// ── Set up ───────────────────────────────────────────────────────────────────

function ConnectedView({ state, onScan, onEnterCode }: { state: SyncState; onScan: () => void; onEnterCode: () => void }) {
  const others = state.devices.filter((d) => d.deviceId !== state.me.deviceId)
  const status = syncSummary(state)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <div role="status" aria-atomic="true" className="mb-10 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-medium tracking-tight text-foreground/90 text-balance">{status.title}</h1>
          <SyncStatusIcon kind={status.kind} className="h-5 w-5 shrink-0 text-foreground/55" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground/50">
          {status.kind === "synced" ? "Keep tasks open on both devices to stay in sync." : status.detail}
        </p>
      </div>

      <section aria-label="Your devices" className="mb-8 shrink-0">
        <DeviceName name={state.me.name} />
        {others.length === 0 ? (
          <p className="text-sm text-foreground/50 py-5">Connect another device to get started.</p>
        ) : (
          <ul className="flex flex-col">
            {others.map((d) => {
              const peer = state.online.find((p) => p.deviceId === d.deviceId)
              const synced = peer?.synced
              const StatusIcon = synced ? CircleCheck : peer ? RefreshCw : Clock3
              const statusLabel = synced ? "Up to date" : peer ? "Syncing" : d.pending ? "Changes waiting to sync" : "Open Tasks on this device to sync"
              return (
                <li
                  key={d.deviceId}
                  className="flex items-start justify-between gap-4 py-4 border-b border-foreground/10"
                >
                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="min-w-0 text-sm text-foreground/80 break-words">{d.name}</p>
                    {peer && <p className="font-mono text-xs text-foreground/40">Online</p>}
                    {!peer && <p className="font-mono text-xs text-foreground/40" title={d.lastSyncedAt ? "Last synced" : "First sync pending"}>
                      <span className="sr-only">{d.lastSyncedAt ? "Last synced " : "First sync "}</span>
                      {d.lastSyncedAt ? ago(d.lastSyncedAt) : "Pending"}
                    </p>}
                  </div>
                  <span role="img" aria-label={statusLabel} title={statusLabel} className="shrink-0 pt-0.5 text-foreground/50">
                    <StatusIcon aria-hidden="true" className={`h-4 w-4 ${peer && !synced ? "motion-safe:animate-spin" : ""}`} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="mt-auto flex shrink-0 flex-col gap-3">
        <button onClick={() => void sync.startHosting()} className={primaryBtn}>
          Sync another device
        </button>
        <button onClick={onEnterCode} className={`${secondaryBtn} flex items-center justify-center gap-2`}>
          <Keyboard className="h-4 w-4" aria-hidden="true" /> Enter a pairing code
        </button>
        <button onClick={onScan} className="min-h-10 rounded-full text-sm text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">Scan a QR code instead</button>
        <LeaveButton />
      </div>
    </div>
  )
}

function DeviceName({ name }: { name: string }) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!editing) setValue(name) }, [name, editing])
  useEffect(() => {
    if (editing) {
      input.current?.focus()
      input.current?.select()
    }
  }, [editing])

  const finish = () => {
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }

  const commit = async () => {
    const next = value.trim()
    if (!next || saving) return
    if (next === name) { finish(); return }
    setSaving(true)
    setError(null)
    try {
      await sync.rename(next)
      finish()
    } catch {
      setError("Couldn’t update the name. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-foreground/10 py-4">
      {editing ? (
        <form aria-label="Rename this device" onSubmit={(event) => { event.preventDefault(); void commit() }}>
          <label htmlFor={inputId} className="text-xs text-foreground/50">Device name</label>
          <input
            ref={input}
            id={inputId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) {
                if (event.key === "Enter") event.preventDefault()
                return
              }
              if (event.key === "Escape" && !saving) { event.preventDefault(); finish() }
            }}
            maxLength={60}
            required
            disabled={saving}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="mt-1 w-full border-b border-foreground/25 bg-transparent py-2 text-base text-foreground/85 outline-none transition-colors focus:border-foreground/70 disabled:opacity-50"
          />
          {error && <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-foreground/65">{error}</p>}
          <div className="mt-2 flex items-center justify-end gap-4">
            <button type="button" onClick={finish} disabled={saving} className="min-h-9 text-xs text-foreground/50 hover:text-foreground/80 disabled:opacity-40 focus-visible:outline-none focus-visible:underline">Cancel</button>
            <button type="submit" disabled={saving || !value.trim()} className="min-h-9 rounded-full bg-foreground/5 px-4 text-xs font-medium text-foreground/80 hover:bg-foreground/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <button ref={trigger} onDoubleClick={() => setEditing(true)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setEditing(true)
            }
          }} title="Double-click to rename" aria-label={`Rename this device: ${name}`} className="flex min-w-0 items-center py-1 text-left text-sm text-foreground/80 focus-visible:outline-none focus-visible:underline">
            <span className="break-words min-w-0">{name}</span>
          </button>
          <span role="img" aria-label="This device" title="This device" className="shrink-0 text-foreground/40">
            <Monitor aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>
      )}
    </div>
  )
}

function LeaveButton() {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-foreground/30 hover:text-foreground/60 transition-colors duration-150 py-2 focus-visible:outline-none"
      >
        Stop syncing on this device
      </button>
    )
  }
  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="text-xs text-foreground/40 leading-relaxed text-center text-pretty">
        Your tasks stay here. To remove a lost device, stop syncing on every device and pair them again.
      </p>
      <div className="flex gap-3">
        <button onClick={() => setConfirming(false)} className={secondaryBtn}>
          Keep syncing
        </button>
        <button onClick={() => void sync.leave()} className={primaryBtn}>
          Stop syncing
        </button>
      </div>
    </div>
  )
}

// ── Pairing ──────────────────────────────────────────────────────────────────

function PairingView({ pairing, onDone, onBackToTasks }: { pairing: Pairing; onDone: () => void; onBackToTasks: () => void }) {
  if (pairing.role === "host") {
    switch (pairing.stage) {
      case "starting":
        return (
          <PendingView
            title="Connect your devices"
            sub="Getting a code ready"
            shimmer
          />
        )
      case "waiting":
        return (
          <section className="flex flex-1 flex-col justify-center py-8 text-center">
            <div className="mb-6">
              <h1 className="mx-auto max-w-[18ch] text-[28px] font-medium leading-tight tracking-tight text-foreground/85 text-balance sm:text-[32px]">Connect your devices</h1>
              <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-relaxed text-foreground/60 text-pretty">Open Tasks on your other device and enter this pairing code, or scan the QR code below. Keep both apps open.</p>
            </div>
            <div className="mb-8 flex flex-col items-center gap-4">
              {pairing.shortCode ? <div>
                <p className="mb-3 text-xs text-foreground/50">Pairing code</p>
                <p className="select-text font-mono text-3xl tracking-widest text-foreground/90" aria-label={`Pairing code ${pairing.shortCode.split("").join(" ")}`}>{formatPairingCode(pairing.shortCode)}</p>
              </div> : <p role="status" className="max-w-[30ch] text-xs leading-relaxed text-foreground/55">{pairing.codeLoading ? "Getting a pairing code…" : pairing.codeError}</p>}
              <QrCode value={pairing.link} label="Pairing QR code" />
              <div className="flex items-center gap-2 text-foreground/35">
                <span aria-hidden="true" className="flex text-foreground/60">
                  <Classic size={16} color="currentColor" />
                </span>
                <Countdown until={pairing.expiresAt} />
              </div>
            </div>
            <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
              {pairing.shortCode && <CopyCode code={pairing.shortCode} />}
              <button onClick={() => void sync.startHosting()} className="min-h-10 rounded-full text-sm text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">Generate new code</button>
              <button onClick={onDone} className="text-sm text-foreground/30 hover:text-foreground/60 transition-colors duration-150 py-2 focus-visible:outline-none">
                Cancel
              </button>
            </div>
          </section>
        )
      case "confirm":
        return (
          <ConfirmationView name={pairing.candidate?.name ?? "A device"} code={pairing.candidate?.code ?? "····"} ready={Boolean(pairing.candidate)} />
        )
      case "done":
        return <PairingComplete onDone={onDone} onBackToTasks={onBackToTasks} />
      case "expired":
        return <Retry title="Code expired" sub="Pairing codes last five minutes." onRetry={() => void sync.startHosting()} />
      case "error":
        return <Retry title="Something went wrong" sub={pairing.error ?? "Try again."} onRetry={() => void sync.startHosting()} />
    }
  }

  switch (pairing.stage) {
    case "confirm":
      return (
        <>
          <Heading
            title={`Sync with ${pairing.hostName}?`}
            sub="Bring the tasks from both devices together. Future changes will sync whenever both apps are open."
          />
          <div className="flex gap-3">
            <button onClick={onDone} className={secondaryBtn}>
              Cancel
            </button>
            <button onClick={() => void sync.acceptJoin()} className={primaryBtn}>
              Connect
            </button>
          </div>
        </>
      )
    case "connecting":
      return (
        <PendingView
          title={`Connecting to ${pairing.hostName}`}
          sub="Keep the other device open on its pairing code."
        />
      )
    case "approve":
      return <ApprovalView name={pairing.hostName} code={pairing.code ?? "····"} onCancel={onDone} />
    case "done":
      return <PairingComplete onDone={onDone} onBackToTasks={onBackToTasks} />
    case "denied":
      return <Finished title="Not connected" sub={`${pairing.hostName} declined the request.`} onDone={onDone} />
    case "expired":
      return <Finished title="Code expired" sub="Ask for a new code on the other device." onDone={onDone} />
    case "error":
      return <Finished title="Something went wrong" sub={pairing.error ?? "Try again."} onDone={onDone} />
  }
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function ConfirmationView({ name, code, ready }: { name: string; code: string; ready: boolean }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <h1 className="text-[28px] font-medium leading-tight tracking-tight text-foreground/85 sm:text-[32px]">Pair this device?</h1>
      <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-foreground/55">Make sure these numbers match on</p>
      <p className="mt-1 max-w-full break-words text-sm font-medium text-foreground/85">{name}</p>
      <Code code={code} />
      <p className="max-w-[28ch] text-sm leading-relaxed text-foreground/60">Only pair if the codes match.</p>
      <div className="mt-6 flex w-full max-w-xs gap-3">
        <button onClick={() => sync.denyCandidate()} className={secondaryBtn}>Deny</button>
        <button onClick={() => void sync.allowCandidate()} disabled={!ready} className={primaryBtn}>Pair devices</button>
      </div>
    </section>
  )
}

function ApprovalView({ name, code, onCancel }: { name: string; code: string; onCancel: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <h1 className="text-[28px] font-medium leading-tight tracking-tight text-foreground/85 sm:text-[32px]">Check the code</h1>
      <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-foreground/55">Make sure these numbers match on</p>
      <p className="mt-1 max-w-full break-words text-sm font-medium text-foreground/85">{name}</p>

      <Code code={code} />

      <p className="max-w-[28ch] text-sm leading-relaxed text-foreground/60">Then tap <span className="font-medium text-foreground/85">Pair devices</span> on that device.</p>
      <div role="status" className="mt-6 flex items-center gap-2 text-xs text-foreground/40">
        <span className="flex text-primary" aria-hidden="true"><Pulse size={16} color="currentColor" /></span>
        Waiting for approval
      </div>
      <button onClick={onCancel} className={`${secondaryBtn} mt-6 max-w-xs`}>Cancel pairing</button>
    </section>
  )
}

function PendingView({ title, sub, shimmer = false }: { title: string; sub: string; shimmer?: boolean }) {
  return (
    <section role="status" aria-atomic="true" className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center text-primary" aria-hidden="true">
        <Eclipse size={24} color="currentColor" />
      </div>
      <h1 className="max-w-[18ch] text-[28px] font-medium leading-tight tracking-tight text-foreground/85 text-balance sm:text-[32px]">{title}</h1>
      <p className={`mt-3 max-w-[30ch] text-sm leading-relaxed text-foreground/50 text-pretty ${shimmer ? styles.shimmer : ""}`}>{sub}</p>
    </section>
  )
}

function PairingComplete({ onDone, onBackToTasks }: { onDone: () => void; onBackToTasks: () => void }) {
  const state = useSync()
  const status = syncSummary(state)
  const complete = status.kind === "synced"
  const preparing = status.kind === "setup"
  const otherName = state.pairing?.role === "join" ? state.pairing.hostName
    : state.pairing?.role === "host" ? state.pairing.candidate?.name
      : undefined
  const deviceName = otherName ?? state.online[0]?.name ?? "Your other device"
  return (
    <section className="pt-2 sm:pt-5">
      <div className="rounded-[28px] border border-foreground/10 px-5 pb-8 pt-8 sm:px-7 sm:pt-10">
        <div className="mb-8 grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-start">
          <PairedDevice name={state.me.name} label="This device" />
          <div className="relative mt-4 flex h-10 items-center justify-center">
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/20" />
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-full border-4 border-background ${complete ? "bg-foreground/85 text-background" : "bg-background text-foreground/60"}`}>
              <SyncStatusIcon kind={preparing ? "syncing" : status.kind} className="h-4 w-4" />
            </div>
          </div>
          <PairedDevice name={deviceName} label="Paired device" />
        </div>

        <div role="status" aria-atomic="true" className="text-center">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            {complete ? "Connected & up to date" : "Device paired"}
          </p>
          <h1 className="text-[32px] leading-[1.15] font-medium tracking-tight text-foreground/90 text-balance">
            {complete ? "You’re all synced." : preparing ? "Bringing your tasks together" : status.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[29ch] text-sm leading-relaxed text-foreground/60">
            {complete ? "Your tasks are in step. Pick up on either device, right where you left off."
              : preparing ? "Keep tasks open on both devices. We’ll confirm when everything matches." : status.detail}
          </p>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-2">
        <button onClick={onBackToTasks} className={`${primaryBtn} flex items-center justify-center gap-2`}>
          Back to tasks <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button onClick={onDone} className="min-h-11 rounded-full text-sm text-foreground/55 hover:text-foreground/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
          Manage devices
        </button>
      </div>

      <p className="mx-auto mt-5 max-w-[32ch] text-center text-xs leading-relaxed text-foreground/45">
        {complete ? "Next time, just open Tasks on both devices. Your changes will sync automatically."
          : "You only need to pair once. Open Tasks on both devices whenever you want to sync."}
      </p>
    </section>
  )
}

function PairedDevice({ name, label }: { name: string; label: string }) {
  const Icon = /phone|ipad|android|tablet/i.test(name) ? Smartphone : Laptop
  return (
    <div className="min-w-0 text-center">
      <div className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-foreground/10 bg-background">
        <Icon className="h-8 w-8 text-foreground/70" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <p className="text-[10px] text-foreground/45">{label}</p>
      <p className="mt-1 break-words text-xs font-medium leading-relaxed text-foreground/75">{name}</p>
    </div>
  )
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1 className="text-4xl font-medium tracking-tight text-foreground/85 mb-1 text-balance">{title}</h1>
      <p className="text-sm text-foreground/60 mt-3 mb-8 leading-relaxed text-pretty">{sub}</p>
    </>
  )
}

function Code({ code }: { code: string }) {
  return (
    <div className="my-8 flex justify-center gap-2 sm:gap-3" role="img" aria-label={`Pairing code ${code.split("").join(" ")}`}>
      {code.split("").map((digit, index) => (
        <span key={index} aria-hidden="true" className="flex h-[72px] w-14 items-center justify-center rounded-[16px] border border-foreground/10 bg-foreground/[0.025] text-[36px] font-medium tabular-nums text-foreground/90 sm:h-20 sm:w-16 sm:text-[40px]">
          {digit}
        </span>
      ))}
    </div>
  )
}

function Finished({ title, sub, onDone }: { title: string; sub: string; onDone: () => void }) {
  return (
    <>
      <Heading title={title} sub={sub} />
      <button onClick={onDone} className={primaryBtn}>
        Done
      </button>
    </>
  )
}

function Retry({ title, sub, onRetry }: { title: string; sub: string; onRetry: () => void }) {
  return (
    <>
      <Heading title={title} sub={sub} />
      <button onClick={onRetry} className={primaryBtn}>
        Get a new code
      </button>
    </>
  )
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(formatPairingCode(code))
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          // Clipboard blocked; the QR code still works.
        }
      }}
      className={`${secondaryBtn} flex items-center justify-center gap-2`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "Code copied" : "Copy pairing code"}
    </button>
  )
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, Math.round((until - now) / 1000))
  const m = Math.floor(left / 60)
  const s = String(left % 60).padStart(2, "0")
  return <p className="text-xs text-foreground/30 tabular-nums">Expires in {m}:{s}</p>
}

function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}
