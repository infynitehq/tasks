"use client"

import { useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { ArrowLeft, ArrowRight, Check, LoaderCircle, X } from "lucide-react"
import { OnboardingAvatar } from "@/components/onboarding-avatar"
import { getTurnConfig } from "@/lib/sync/turn"

async function gather(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("ICE gathering timed out")), 15_000)
    const changed = () => { if (peer.iceGatheringState === "complete") finish() }
    const finish = (error?: Error) => {
      clearTimeout(timer)
      peer.removeEventListener("icegatheringstatechange", changed)
      if (error) reject(error)
      else resolve()
    }
    peer.addEventListener("icegatheringstatechange", changed)
    changed()
  })
}

async function checkRelay(server: RTCIceServer, report: (message: string) => void) {
  const config: RTCConfiguration = { iceServers: [server], iceTransportPolicy: "relay" }
  const a = new RTCPeerConnection(config)
  const b = new RTCPeerConnection(config)
  const errors = new Set<string>()
  for (const peer of [a, b]) {
    peer.onicecandidateerror = (event) => {
      errors.add(`${event.errorCode}: ${event.errorText || "TURN candidate error"}`)
    }
  }
  function verifyAllocation(peer: RTCPeerConnection, label: string) {
    if (!peer.localDescription?.sdp.match(/^a=candidate:.*\btyp relay\b/m)) {
      throw new Error(`Peer ${label}: no TURN relay candidate was allocated. ${
        [...errors].join("; ") || "Check TURN authentication and reachability."
      }`)
    }
    report(`Peer ${label}: TURN relay candidate allocated.`)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const channel = a.createDataChannel("turn-check")
    b.ondatachannel = ({ channel: incoming }) => {
      incoming.onmessage = ({ data }) => incoming.send(data)
    }
    await a.setLocalDescription(await a.createOffer())
    await gather(a)
    verifyAllocation(a, "A")
    await b.setRemoteDescription(a.localDescription!)
    await b.setLocalDescription(await b.createAnswer())
    await gather(b)
    verifyAllocation(b, "B")
    await a.setRemoteDescription(b.localDescription!)
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(
        `TURN allocations succeeded, but data transfer timed out (ICE ${a.iceConnectionState}/${b.iceConnectionState}). Check relay UDP ports, advertised public IP, and server peer permissions.`
      )), 15_000)
      channel.onmessage = ({ data }) => { if (data === "turn-ok") resolve() }
      channel.onerror = () => reject(new Error("Data channel failed"))
      channel.onopen = () => channel.send("turn-ok")
      if (channel.readyState === "open") channel.send("turn-ok")
    })
    const stats = await a.getStats()
    let relayed = false
    stats.forEach((stat) => {
      if (stat.type === "transport" && stat.selectedCandidatePairId) {
        const pair = stats.get(stat.selectedCandidatePairId)
        const candidate = pair && stats.get(pair.localCandidateId)
        if (candidate?.candidateType === "relay") relayed = true
      }
    })
    if (!relayed) throw new Error("Data passed, but selected relay candidate could not be verified")
  } finally {
    clearTimeout(timer)
    a.close()
    b.close()
  }
}

export default function SyncCheck() {
  const { resolvedTheme } = useTheme()
  const [status, setStatus] = useState<"idle" | "running" | "passed" | "failed">("idle")
  const [results, setResults] = useState<string[]>([])
  const [passed, setPassed] = useState(0)
  const [total, setTotal] = useState(0)
  const running = status === "running"
  async function run() {
    if (running) return
    setStatus("running")
    setResults([])
    setPassed(0)
    setTotal(0)
    let failed = false
    try {
      if (typeof RTCPeerConnection === "undefined") throw new Error("This browser does not support WebRTC. Try a modern browser.")
      const { iceServers } = await getTurnConfig()
      if (!iceServers.length) throw new Error("TURN is not configured. Set TURN_URLS and TURN_SHARED_SECRET on the server.")
      const count = iceServers.reduce((sum, server) => sum + (typeof server.urls === "string" ? 1 : server.urls.length), 0)
      if (!count) throw new Error("No TURN URLs are configured.")
      setTotal(count)
      for (const server of iceServers) {
        for (const url of typeof server.urls === "string" ? [server.urls] : server.urls) {
          setResults((rows) => [...rows, `Testing ${url}…`])
          try {
            await checkRelay({ ...server, urls: url }, (message) => {
              setResults((rows) => [...rows, message])
            })
            setResults((rows) => [...rows, `PASS ${url}: authenticated relay allocation and data round-trip.`])
            setPassed((value) => value + 1)
          } catch (error) {
            failed = true
            setResults((rows) => [...rows, `FAIL ${url}: ${error instanceof Error ? error.message : "Connection failed"}`])
          }
        }
      }
    } catch (error) {
      failed = true
      setResults((rows) => [...rows, error instanceof Error ? error.message : "Check failed"])
    } finally {
      setStatus(failed ? "failed" : "passed")
    }
  }
  return (
    <main className="h-dvh overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-6">
        <Link href="/" className="flex w-fit items-center gap-1.5 rounded text-sm text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to tasks
        </Link>

        <section className="flex flex-col items-center py-6 text-center" aria-labelledby="check-title" aria-busy={running}>
          <OnboardingAvatar size={192} dark={resolvedTheme === "dark"} mood={status === "passed" ? "happy" : status === "failed" ? "sad" : "neutral"} />
          <div role="status" aria-live="polite" aria-atomic="true" className="mt-3">
            <h1 id="check-title" className="text-2xl font-medium tracking-tight">
              {status === "passed" ? "Looking good." : status === "failed" ? "A little hiccup." : running ? "Checking the connection…" : "Ready to connect?"}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-foreground/60">
              {status === "passed" ? "Your TURN relay is ready for WebRTC traffic."
                : status === "failed" ? "A check failed. See the details below."
                : running ? "Testing relay access and a message round-trip."
                : "Test your relay for when direct connections can’t get through."}
            </p>
            {total > 0 && (
              <p className="mt-2 text-xs text-foreground/50">{passed} of {total} relay checks passed</p>
            )}
          </div>

          <button
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
            {running ? "Checking…" : status === "idle" ? "Check connection" : "Check again"}
            {!running && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </section>

        {results.length > 0 && (
          <section aria-labelledby="technical-details-title" className="mb-6 border-t border-foreground/10 pt-4">
            <h2 id="technical-details-title" className="mb-3 text-sm font-medium text-foreground/70">Technical details</h2>
            <ul className="space-y-2" aria-label="TURN check results">
              {results.map((result, index) => (
                <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/60">
                  {result.startsWith("PASS") ? <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700 dark:text-green-400" />
                    : result.startsWith("FAIL") ? <X aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    : <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />}
                  <span className="min-w-0 break-words font-mono">{result}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pb-[env(safe-area-inset-bottom)] text-center text-xs leading-relaxed text-foreground/50">
          Powered by WebRTC. Try on Wi-Fi and mobile data.<br />
          This tests TURN only—not pairing or cross-device task sync.
        </p>
      </div>
    </main>
  )
}
