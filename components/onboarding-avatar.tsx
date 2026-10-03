"use client"

import { botAvatarShapes } from "bot-avatars"
import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import styles from "./onboarding-avatar.module.css"

interface OnboardingAvatarProps {
  size?: number
  dark: boolean
}

export function OnboardingAvatar({ size = 48, dark }: OnboardingAvatarProps) {
  const shadingId = useId()
  const shineId = useId()
  const rimId = useId()
  const bodyClipId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const [hop, setHop] = useState(0)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let target = { x: 0, y: 0 }
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setGaze(target)
      })
    }
    const reset = () => { target = { x: 0, y: 0 }; update() }
    const follow = (event: PointerEvent) => {
      const container = containerRef.current
      if (!container || motion.matches || event.pointerType === "touch") return
      const rect = container.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) return
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height
      const distance = Math.hypot(x, y)
      const divisor = Math.max(1, distance)
      target = { x: x / divisor, y: y / divisor }
      update()
    }
    document.addEventListener("pointermove", follow, { passive: true })
    document.addEventListener("pointerleave", reset)
    window.addEventListener("blur", reset)
    motion.addEventListener("change", reset)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("pointermove", follow)
      document.removeEventListener("pointerleave", reset)
      window.removeEventListener("blur", reset)
      motion.removeEventListener("change", reset)
    }
  }, [])

  return (
    <div ref={containerRef} aria-hidden="true" className="shrink-0" style={{ width: size, height: size, "--hop-height": `${size * 0.12}px` } as CSSProperties}>
      <svg
        key={hop}
        data-onboarding-avatar
        viewBox="-10 -10 120 120"
        width={size}
        height={size}
        className={`${styles.avatar} ${celebrating ? styles.celebrating : ""}`}
        focusable="false"
        onClick={() => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
          setHop((value) => value + 1)
          setCelebrating(true)
        }}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setCelebrating(false)
        }}
      >
        <defs>
          <linearGradient id={shadingId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.3" />
            <stop offset="0.4" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="black" stopOpacity={dark ? 0.42 : 0.34} />
          </linearGradient>
          <radialGradient id={shineId} cx="30%" cy="20%" r="65%" gradientTransform="translate(0 0.04) scale(1 0.8)">
            <stop offset="0" stopColor="white" stopOpacity="0.86" />
            <stop offset="0.12" stopColor="white" stopOpacity="0.62" />
            <stop offset="0.3" stopColor="white" stopOpacity="0.12" />
            <stop offset="0.7" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.65" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.08" />
            <stop offset="1" stopColor="white" stopOpacity="0.32" />
          </linearGradient>
          <clipPath id={bodyClipId}><path d={botAvatarShapes.flower} /></clipPath>
        </defs>
        {/* Use the library's vector outline, without its raster canvas renderer. */}
        <path d={botAvatarShapes.flower} fill="var(--primary)" />
        <path d={botAvatarShapes.flower} fill={`url(#${shadingId})`} />
        <path d={botAvatarShapes.flower} fill={`url(#${shineId})`} />
        <g clipPath={`url(#${bodyClipId})`}>
          <path d={botAvatarShapes.flower} fill="none" stroke={`url(#${rimId})`} strokeWidth="2" />
          <path d="M31 25 Q36 18 44 18" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className={styles.gaze} style={{ transform: `translate(${gaze.x * 2}px, ${gaze.y * 1.5}px)` }}>
          <g className={styles.eyes}>
            {[37.5, 62.5].map((x) => (
              <g key={x}>
                <ellipse cx={x} cy="51" rx="6.3" ry="8.2" fill="white" />
                <ellipse cx={x + gaze.x * 2.2} cy={51 + gaze.y * 2.6} rx="2.8" ry="3.6" fill="#1e1a33" />
              </g>
            ))}
          </g>
          <path d="M44 64 Q50 70 56 64" fill="none" stroke="#1e1a33" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
