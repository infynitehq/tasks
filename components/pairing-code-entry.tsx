"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ScanLine } from "lucide-react"
import { normalizePairingCode } from "@/lib/pairing-code"
import { b64u, randomBytes } from "@/lib/sync/crypto"
import { sync } from "@/lib/sync/manager"

export function PairingCodeEntry({ onCancel, onScan }: { onCancel: () => void; onScan: () => void }) {
  const inputId = useId()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const attempt = useRef<{ code: string; id: string } | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const submit = async () => {
    if (controller.current) return
    const code = normalizePairingCode(value)
    if (!code) { setError("Enter the eight-character code shown on your other device."); return }
    if (!window.isSecureContext || !crypto.subtle) { setError("Syncing needs HTTPS. Open the secure site in your installed app."); return }
    // Keep the claim ID for retries, including after leaving and reopening the
    // entry screen. sessionStorage is local, short-lived and optional.
    if (attempt.current?.code !== code) {
      let saved: { code: string; id: string; expires: number } | null = null
      try { saved = JSON.parse(sessionStorage.getItem("tasks-pairing-attempt") || "null") } catch { /* storage unavailable */ }
      const id = saved?.code === code && saved.expires > Date.now() && /^[A-Za-z0-9_-]{32}$/.test(saved.id) ? saved.id : b64u(randomBytes(24))
      attempt.current = { code, id }
      try { sessionStorage.setItem("tasks-pairing-attempt", JSON.stringify({ code, id, expires: Date.now() + 300_000 })) } catch { /* retries still work in this view */ }
    }
    const request = new AbortController()
    controller.current = request
    setError(null)
    setBusy(true)
    try {
      await sync.openPairCode(code, attempt.current.id, request.signal)
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn’t open that code. Try again.")
    } finally {
      if (controller.current === request) controller.current = null
      if (!request.signal.aborted) setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight text-foreground/90">Enter a pairing code</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">On your other device, choose “Sync with another device.” Enter its eight-character code here. Keep both apps open.</p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="flex flex-col gap-4">
        <label htmlFor={inputId} className="text-sm text-foreground/65">Pairing code</label>
        <input id={inputId} value={value} onChange={(event) => { setValue(event.target.value); setError(null) }} placeholder="K7MX-4P9Q" maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className="w-full min-w-0 rounded-xl border border-foreground/15 bg-transparent px-4 py-4 text-center font-mono text-2xl uppercase tracking-widest text-foreground outline-none focus:border-foreground/50" />
        {error && <p id={`${inputId}-error`} role="alert" className="text-sm leading-relaxed text-foreground/70">{error}</p>}
        <button disabled={busy || !value.trim()} type="submit" className="w-full rounded-full bg-foreground/85 py-3.5 text-sm font-medium text-background disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">{busy ? "Finding your device…" : "Continue"}</button>
      </form>
      <button onClick={onScan} className="flex min-h-10 items-center justify-center gap-2 rounded-full border border-foreground/15 text-sm text-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
        <ScanLine aria-hidden="true" className="h-4 w-4" /> Scan a QR code instead
      </button>
      <button onClick={onCancel} className="min-h-10 rounded-full text-sm text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">Cancel</button>
      <p className="text-center text-xs leading-relaxed text-foreground/45">Codes expire after five minutes. You’ll confirm before pairing.</p>
    </section>
  )
}
