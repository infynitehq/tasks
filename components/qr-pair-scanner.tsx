"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Keyboard, RefreshCw } from "lucide-react"
import { sync } from "@/lib/sync/manager"
import { decodePairLink } from "@/lib/sync/protocol"

export function QrPairScanner({ onCancel, onEnterCode }: { onCancel: () => void; onEnterCode: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const submitting = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let frame = 0
    let lastScan = 0
    const video = videoRef.current
    setCameraReady(false)
    setCameraError(null)

    const stop = () => {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }

    async function start() {
      if (!window.isSecureContext) {
        setCameraError("Camera scanning needs HTTPS. Open the secure site in your installed app. For local testing, use an HTTPS dev server; syncing also needs HTTPS.")
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser doesn’t support camera access. Enter a pairing code instead.")
        return
      }
      try {
        const { default: jsQR } = await import("jsqr")
        if (cancelled) return
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled || !video) { stop(); return }
        video.srcObject = stream
        await video.play()
        if (cancelled) { stop(); return }
        setCameraReady(true)
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) throw new Error("Canvas unavailable")

        const scan = (time: number) => {
          if (cancelled) return
          frame = requestAnimationFrame(scan)
          if (submitting.current || time - lastScan < 180 || video.readyState < 2) return
          lastScan = time
          const scale = Math.min(1, 800 / video.videoWidth)
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          if (!canvas.width || !canvas.height) return
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const image = context.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })
          if (!result) return
          if (!decodePairLink(result.data)) {
            setLinkError("That isn’t a Tasks pairing code. Scan the code shown on your other device.")
            return
          }
          submitting.current = true
          void sync.openPairLink(result.data).catch(() => {
            if (!cancelled) setLinkError("Couldn’t open this pairing code. Try again.")
          }).finally(() => {
            submitting.current = false
          })
        }
        frame = requestAnimationFrame(scan)
      } catch (error) {
        stop()
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ""
        setCameraError(name === "NotAllowedError"
          ? "Camera access was denied. Allow camera access in your browser settings and retry, or enter a pairing code."
          : name === "NotFoundError"
            ? "No camera was found. Enter a pairing code instead."
            : "Couldn’t start the camera. Close other apps using it and retry, or enter a pairing code.")
      }
    }

    const onVisibility = () => {
      if (document.hidden) { cancelled = true; stop() }
      else setAttempt((value) => value + 1)
    }
    document.addEventListener("visibilitychange", onVisibility)
    void start()
    return () => {
      cancelled = true
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [attempt])

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight text-foreground/90">Scan a pairing code</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">On your other device, choose “Sync with another device.” Scan its code here to pair this app.</p>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-foreground/5">
        <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview for scanning a pairing QR code" className={`h-full w-full object-cover ${cameraReady ? "" : "invisible"}`} />
        {!cameraReady && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm leading-relaxed text-foreground/65">
          <Camera aria-hidden="true" className="h-8 w-8" />
          <p>{cameraError ?? "Starting camera…"}</p>
        </div>}
      </div>
      {cameraError && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="flex min-h-10 items-center justify-center gap-2 text-sm text-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
        <RefreshCw aria-hidden="true" className="h-4 w-4" /> Retry camera
      </button>}
      {linkError && <p role="alert" className="text-sm leading-relaxed text-foreground/70">{linkError}</p>}
      <button onClick={onEnterCode} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/15 text-sm text-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
        <Keyboard aria-hidden="true" className="h-4 w-4" /> Enter a pairing code instead
      </button>
      <button type="button" onClick={onCancel} className="min-h-10 rounded-full text-sm text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">Cancel</button>
      <p className="text-center text-xs leading-relaxed text-foreground/45">Camera images stay on this device. You’ll confirm before pairing.</p>
    </section>
  )
}
