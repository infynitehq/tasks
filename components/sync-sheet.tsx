"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowLeft, Check, Copy } from "lucide-react"
import { Orbit, Radar, Ripple, Swirl } from "loading-dev"
import { useSync } from "@/hooks/use-sync"
import { sync, type SyncState, type Pairing } from "@/lib/sync/manager"
import { QrCode } from "./qr-code"

const primaryBtn =
  "w-full py-3.5 rounded-full bg-foreground/85 text-background text-sm font-medium hover:bg-foreground/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none"
const secondaryBtn =
  "w-full py-3.5 rounded-full border border-foreground/15 text-foreground/60 text-sm font-medium hover:border-foreground/30 hover:text-foreground/80 transition-colors duration-150 focus-visible:outline-none"

export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useSync()

  const close = () => {
    // Leaving mid-pairing cancels it; leaving a finished one just clears it.
    if (state.pairing) void sync.cancelPairing()
    sync.clearError()
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
          <div className="w-full max-w-md px-4 pt-20 pb-16">
            <div className="flex justify-start mb-12">
              <button
                onClick={close}
                className="flex items-center gap-1.5 text-foreground/30 hover:text-foreground/60 transition-colors duration-150 focus-visible:outline-none"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>
            </div>

            {!state.ready ? (
              <Heading title="Sync" sub="Getting sync ready…" />
            ) : state.pairing ? (
              <PairingView pairing={state.pairing} onDone={() => void sync.cancelPairing()} />
            ) : state.enabled ? (
              <ConnectedView state={state} />
            ) : (
              <OffView error={state.error} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Not set up ───────────────────────────────────────────────────────────────

function OffView({ error }: { error: string | null }) {
  return (
    <>
      <Heading title="Sync" sub="Keep your tasks in step across your devices. They travel directly between them, end-to-end encrypted, with no account and no server holding your data." />
      {error && <p className="text-sm text-foreground/50 mb-6">{error}</p>}
      <button onClick={() => void sync.startHosting()} className={primaryBtn}>
        Add a device
      </button>
      <p className="text-xs text-foreground/30 mt-4 leading-relaxed text-center">
        Both devices need to be open at the same time to sync.
      </p>
    </>
  )
}

// ── Set up ───────────────────────────────────────────────────────────────────

function ConnectedView({ state }: { state: SyncState }) {
  const onlineIds = new Set(state.online.map((p) => p.deviceId))
  const others = state.devices.filter((d) => d.deviceId !== state.me.deviceId)
  const status = !state.connected
    ? state.error ?? "Connecting…"
    : state.online.length
    ? `Syncing with ${state.online.length} device${state.online.length === 1 ? "" : "s"}`
    : "Waiting for your other devices. Open the app on one to sync."

  return (
    <>
      <Heading title="Sync" sub={status} />

      <Section label="This device">
        <DeviceName name={state.me.name} />
      </Section>

      <Section label="Other devices">
        {others.length === 0 ? (
          <p className="text-sm text-foreground/35 py-3">None yet.</p>
        ) : (
          <ul className="flex flex-col">
            {others.map((d) => {
              const online = onlineIds.has(d.deviceId)
              return (
                <li
                  key={d.deviceId}
                  className="flex items-center justify-between py-3 border-b border-foreground/5 last:border-b-0"
                >
                  <span className="text-base text-foreground/75 truncate">{d.name}</span>
                  <span className="flex items-center gap-2 text-xs text-foreground/35 flex-shrink-0 ml-4">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${online ? "bg-foreground/80" : "bg-foreground/15"}`}
                      aria-hidden
                    />
                    {online ? "Online" : `Last seen ${ago(d.lastSeen)}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <div className="flex flex-col gap-3">
        <button onClick={() => void sync.startHosting()} className={primaryBtn}>
          Add a device
        </button>
        <LeaveButton />
      </div>
    </>
  )
}

function DeviceName({ name }: { name: string }) {
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [name])
  const commit = () => {
    if (value.trim() && value.trim() !== name) void sync.rename(value)
    else setValue(name)
  }
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) e.currentTarget.blur()
      }}
      maxLength={60}
      aria-label="This device's name"
      className="w-full py-3 bg-transparent border-b border-foreground/15 text-base text-foreground/80 focus:outline-none focus:border-foreground/35 transition-colors duration-150"
    />
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

function PairingView({ pairing, onDone }: { pairing: Pairing; onDone: () => void }) {
  if (pairing.role === "host") {
    switch (pairing.stage) {
      case "starting":
        return (
          <Heading
            title="Add a device"
            sub="Getting a code ready…"
            indicator={<Swirl size={28} color="currentColor" />}
          />
        )
      case "waiting":
        return (
          <>
            <Heading title="Add a device" sub="Scan this with the camera on your other device." />
            <div className="flex flex-col items-center gap-5 mb-10">
              <QrCode value={pairing.link} label="Pairing code" />
              <div className="flex items-center gap-2 text-foreground/35">
                <span aria-hidden="true" className="flex text-foreground/60">
                  <Radar size={16} color="currentColor" />
                </span>
                <Countdown until={pairing.expiresAt} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <CopyLink link={pairing.link} />
              <button onClick={onDone} className="text-sm text-foreground/30 hover:text-foreground/60 transition-colors duration-150 py-2 focus-visible:outline-none">
                Cancel
              </button>
            </div>
          </>
        )
      case "confirm":
        return (
          <>
            <Heading
              title={`${pairing.candidate?.name ?? "A device"} wants to join`}
              sub="Allow it only if the same code shows on that device."
            />
            <Code code={pairing.candidate?.code ?? "····"} />
            <div className="flex gap-3">
              <button onClick={() => sync.denyCandidate()} className={secondaryBtn}>
                Deny
              </button>
              <button onClick={() => void sync.allowCandidate()} className={primaryBtn}>
                Allow
              </button>
            </div>
          </>
        )
      case "done":
        return <Finished title="Device added" sub="Your tasks are syncing." onDone={onDone} />
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
            sub="Tasks on both devices will be combined. Nothing is deleted."
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
        <Heading
          title={`Connecting to ${pairing.hostName}`}
          sub="Keep the other device open on its pairing code."
          indicator={<Orbit size={28} color="currentColor" />}
        />
      )
    case "approve":
      return (
        <>
          <Heading
            title={`Approve on ${pairing.hostName}`}
            sub="Check that the same code shows there, then tap Allow on it."
            indicator={<Ripple size={28} color="currentColor" />}
          />
          <Code code={pairing.code ?? "····"} />
        </>
      )
    case "done":
      return <Finished title="Connected" sub={`Your tasks are syncing with ${pairing.hostName}.`} onDone={onDone} />
    case "denied":
      return <Finished title="Not connected" sub={`${pairing.hostName} declined the request.`} onDone={onDone} />
    case "expired":
      return <Finished title="Code expired" sub="Ask for a new code on the other device." onDone={onDone} />
    case "error":
      return <Finished title="Something went wrong" sub={pairing.error ?? "Try again."} onDone={onDone} />
  }
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Heading({ title, sub, indicator }: { title: string; sub: string; indicator?: ReactNode }) {
  return (
    <>
      {indicator && (
        <div className="mb-8 text-foreground/45" aria-hidden="true">
          {indicator}
        </div>
      )}
      <h1 className="text-4xl font-medium tracking-tight text-foreground/85 mb-1 text-balance">{title}</h1>
      <p className="text-sm text-foreground/30 mb-10 leading-relaxed text-pretty">{sub}</p>
    </>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-10">
      <p className="text-xs text-foreground/30 mb-1 tracking-wide uppercase">{label}</p>
      {children}
    </div>
  )
}

function Code({ code }: { code: string }) {
  return (
    <p
      className="text-6xl font-medium tracking-[0.3em] text-foreground/85 text-center tabular-nums mb-12 pl-[0.3em]"
      aria-label={`Code ${code.split("").join(" ")}`}
    >
      {code}
    </p>
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

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          // Clipboard blocked; the QR code still works.
        }
      }}
      className={`${secondaryBtn} flex items-center justify-center gap-2`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "Link copied" : "Copy link instead"}
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
