"use client"

import { useState } from "react"
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
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<string[]>([])
  async function run() {
    setRunning(true)
    setResults([])
    try {
      const { iceServers } = await getTurnConfig()
      if (!iceServers.length) throw new Error("TURN is not configured. Set TURN_URLS and TURN_SHARED_SECRET on the server.")
      for (const server of iceServers) {
        for (const url of typeof server.urls === "string" ? [server.urls] : server.urls) {
          setResults((rows) => [...rows, `Testing ${url}…`])
          try {
            await checkRelay({ ...server, urls: url }, (message) => {
              setResults((rows) => [...rows, message])
            })
            setResults((rows) => [...rows, `PASS ${url}: authenticated relay allocation and data round-trip.`])
          } catch (error) {
            setResults((rows) => [...rows, `FAIL ${url}: ${error instanceof Error ? error.message : "Connection failed"}`])
          }
        }
      }
    } catch (error) {
      setResults((rows) => [...rows, error instanceof Error ? error.message : "Check failed"])
    } finally {
      setRunning(false)
    }
  }
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">TURN connection check</h1>
      <p>Tests each configured TURN URL separately using relay-only WebRTC and an echoed message. Run on Wi-Fi and mobile data. This checks TURN; pairing and cross-device task sync need a separate two-device test.</p>
      <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={running} onClick={() => void run()}>
        {running ? "Testing…" : "Test TURN"}
      </button>
      <pre className="whitespace-pre-wrap text-sm" aria-live="polite">{results.join("\n")}</pre>
      <a className="block underline" href="/">Back to tasks</a>
    </main>
  )
}
