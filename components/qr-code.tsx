"use client"

import { useMemo } from "react"
import { encode } from "uqr"

/**
 * Always dark modules on a white plate, whatever the theme: plenty of phone
 * cameras refuse an inverted (light-on-dark) code.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 })
    let d = ""
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`
      })
    )
    return { path: d, size: qr.size }
  }, [value])

  return (
    <div className="rounded-[24px] bg-white p-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="block w-56 h-56"
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
      >
        <path d={path} fill="#000" />
      </svg>
    </div>
  )
}
