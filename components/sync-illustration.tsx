"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { mountTwinTrays } from "@/lib/hairline/twin-trays"
import styles from "./sync-illustration.module.css"

export function SyncIllustration({ compact = false }: { compact?: boolean }) {
  const stage = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const kernel = (window as Window & { HL?: Parameters<typeof mountTwinTrays>[0] }).HL
    if (!ready || !kernel || !stage.current || !svg.current) return
    return mountTwinTrays(kernel, stage.current, svg.current)
  }, [ready])

  return (
    <>
      <Script src="/hairline-kernel.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={stage} className={`mx-auto w-full ${compact ? styles.compact : "mb-6 max-w-[340px]"} ${styles.stage}`} aria-hidden="true">
        <svg ref={svg} viewBox="0 0 400 320" className="block aspect-[5/4] w-full" />
      </div>
    </>
  )
}
