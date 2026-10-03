"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import styles from "./guided-tour.module.css"
import { OnboardingAvatar } from "./onboarding-avatar"

const STEPS = [
  { target: "entry", title: "Make room for what matters", text: "Type a task and press Enter to add it to this day. Tap a task to mark it done, or tap again to undo. Nothing is added during this tour." },
  { target: "dates", title: "A little planning goes a long way", text: "Choose a day in the week strip or use the arrows to plan ahead. Past days are read-only. Unfinished tasks automatically roll forward to today." },
  { target: "filters", title: "Find your focus", text: "Switch between All, Active, and Done. When you have completed tasks, a trash icon appears beside these controls to clear them." },
  { target: "import", title: "Bring your list along", text: "Use bulk import to paste several tasks, one per line. You can choose which day to add them to, and duplicates are skipped." },
  { target: "summary", title: "See how you’re doing", text: "Open your summary for daily progress, your completion streak, and recent history. You can also find tasks that have rolled over repeatedly." },
  { target: "preferences", title: "Your tasks, wherever you are", text: "Use device sync to pair another device and keep your tasks together. You can replay this tour anytime using the help button." },
] as const

// Art direction per feature; coordinates remain relative to the live controls.
// Wide layouts use the outer gutter, while narrow layouts use a vertical corridor.
const STEP_VISUALS = {
  entry: { paddingX: 8, paddingY: 7, gap: 88, side: "left", anchor: 0.72, offset: -76, loopWidth: 21, loopHeight: 11, loopPosition: 0.52 },
  dates: { paddingX: 6, paddingY: 6, gap: 92, side: "right", anchor: 0.1, offset: 44, loopWidth: 13, loopHeight: 15, loopPosition: 0.48 },
  filters: { paddingX: 8, paddingY: 7, gap: 82, side: "left", anchor: 0.45, offset: 68, loopWidth: 19, loopHeight: 10, loopPosition: 0.55 },
  import: { paddingX: 5, paddingY: 5, gap: 88, side: "right", anchor: 0.5, offset: -72, loopWidth: 21, loopHeight: 12, loopPosition: 0.48 },
  summary: { paddingX: 5, paddingY: 5, gap: 96, side: "right", anchor: 0.5, offset: -54, loopWidth: 15, loopHeight: 16, loopPosition: 0.55 },
  preferences: { paddingX: 5, paddingY: 5, gap: 84, side: "right", anchor: 0.85, offset: -36, loopWidth: 12, loopHeight: 12, loopPosition: 0.5 },
} as const

interface Highlight {
  left: number
  top: number
  width: number
  height: number
}

interface GuidedTourProps {
  open: boolean
  dark: boolean
  onFinish: () => void
}

interface Placement {
  cardLeft: number
  cardTop: number
  arrow: string
  highlights: Highlight[]
}

export function GuidedTour({ open, dark, onFinish }: GuidedTourProps) {
  const spotlightId = useId()
  const arrowheadId = useId()
  const [step, setStep] = useState(0)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const current = STEPS[step]
  const visual = STEP_VISUALS[current.target]

  useEffect(() => {
    if (!open) return
    setStep(0)
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.showModal()
    nextRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`)
    const regions = target ? current.target === "dates"
      ? Array.from(target.querySelectorAll<HTMLElement>("[data-tour-region]"))
      : current.target === "preferences" ? Array.from(target.querySelectorAll<HTMLElement>("button")).slice(0, 1) : [target]
      : []
    const card = cardRef.current
    if (!card) return
    const activeTargets = current.target === "preferences" ? regions : target ? [target] : []
    activeTargets.forEach((region) => region.classList.add(styles.activeTarget))

    const update = () => {
      const viewport = window.visualViewport
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      const offsetLeft = viewport?.offsetLeft ?? 0
      const offsetTop = viewport?.offsetTop ?? 0
      const highlights = regions.map((region) => {
        const bounds = region.getBoundingClientRect()
        const left = Math.max(offsetLeft + 4, bounds.left - visual.paddingX)
        const top = Math.max(offsetTop + 4, bounds.top - visual.paddingY)
        const right = Math.min(offsetLeft + width - 4, bounds.right + visual.paddingX)
        const bottom = Math.min(offsetTop + height - 4, bounds.bottom + visual.paddingY)
        return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
      })
      if (!highlights.length) return
      const left = Math.min(...highlights.map((region) => region.left))
      const top = Math.min(...highlights.map((region) => region.top))
      const right = Math.max(...highlights.map((region) => region.left + region.width))
      const bottom = Math.max(...highlights.map((region) => region.top + region.height))
      const gap = visual.gap
      const roomBelow = offsetTop + height - bottom
      const roomAbove = top - offsetTop
      const placeBelow = roomBelow >= roomAbove
      const roomBeside = visual.side === "left" ? left - offsetLeft : offsetLeft + width - right
      const beside = roomBeside >= 300 + gap + 12
      const preferencesDock = !beside && current.target === "preferences"
      const preferencesTop = bottom + 80
      card.style.width = beside ? "300px" : preferencesDock ? `${Math.min(360, width - 24)}px` : ""
      // Reserve an actual corridor for the arrow, even on short screens.
      // The card scrolls internally when the available side is cramped.
      card.style.maxHeight = `${beside ? height - 24 : preferencesDock ? Math.max(80, offsetTop + height - preferencesTop - 12) : Math.max(80, (placeBelow ? roomBelow : roomAbove) - gap - 12)}px`
      const cardWidth = card.offsetWidth
      const cardHeight = card.offsetHeight
      const below = bottom + gap
      const above = top - cardHeight - gap
      const targetCenter = (left + right) / 2
      const viewportCenter = offsetLeft + width / 2
      const targetOnRight = targetCenter > viewportCenter + 24
      const targetOnLeft = targetCenter < viewportCenter - 24
      // Align the card with the target's outer edge, leaving room for the
      // connector to approach inward rather than bending toward the screen edge.
      const preferredCardLeft = targetOnRight ? right - cardWidth
        : targetOnLeft ? left : targetCenter - cardWidth / 2
      const cardLeft = preferencesDock ? Math.max(offsetLeft + 12, Math.min(right - cardWidth, offsetLeft + width - cardWidth - 12)) : beside ? visual.side === "left" ? left - gap - cardWidth : right + gap
        : Math.max(offsetLeft + 12, Math.min(preferredCardLeft, offsetLeft + width - cardWidth - 12))
      const cardTop = Math.max(offsetTop + 12, Math.min(preferencesDock ? preferencesTop : beside ? (top + bottom - cardHeight) / 2 : placeBelow ? below : above, offsetTop + height - cardHeight - 12))
      // Keep the date-section connector away from the centered Tasks heading.
      const anchorX = left + (right - left) * visual.anchor
      const endX = Math.max(offsetLeft + 20, Math.min(anchorX, offsetLeft + width - 20))
      const endY = placeBelow ? bottom + 12 : top - 12
      const minStartX = cardLeft + 24
      const maxStartX = cardLeft + cardWidth - 24
      const roomToLeft = Math.max(0, endX - minStartX)
      const roomToRight = Math.max(0, maxStartX - endX)
      const preferredDirection = visual.offset > 0 ? 1 : -1
      const preferredRoom = preferredDirection === 1 ? roomToRight : roomToLeft
      const oppositeRoom = preferredDirection === 1 ? roomToLeft : roomToRight
      const curveDirection = preferredRoom < 40 && oppositeRoom > preferredRoom
        ? -preferredDirection : preferredDirection
      const curveWidth = Math.abs(visual.offset)
      const startX = Math.max(minStartX, Math.min(endX + curveDirection * curveWidth, maxStartX))
      const startY = placeBelow ? cardTop - 12 : cardTop + cardHeight + 12
      const direction = placeBelow ? -1 : 1
      const corridor = (endY - startY) * direction
      // Draw a loose rope loop entirely inside the connector corridor.
      let fromX = startX
      let fromY = startY
      let toX = endX
      let toY = endY
      if (beside) {
        const region = current.target === "dates" ? highlights[highlights.length - 1] : highlights[0]
        toX = visual.side === "left" ? left - 12 : right + 12
        toY = region.top + region.height / 2
        fromX = visual.side === "left" ? cardLeft + cardWidth + 12 : cardLeft - 12
        fromY = Math.max(cardTop + 24, Math.min(toY + (current.target === "dates" ? -40 : 44), cardTop + cardHeight - 24))
      }
      const iconFromBelow = beside && (current.target === "import" || current.target === "summary" || current.target === "preferences")
      if (iconFromBelow) {
        toX = targetCenter
        toY = bottom + 12
        fromY = toY + 32
      }
      // Keep sync's connector compact: the card sits nearby and the arrow
      // approaches from directly below, never winding around the viewport.
      if (preferencesDock) {
        const region = highlights[0]
        fromX = Math.max(cardLeft + 24, Math.min(region.left + region.width / 2 - 56, cardLeft + cardWidth - 24))
        fromY = cardTop - 12
        toX = region.left + region.width / 2
        toY = region.top + region.height + 12
      }
      const horizontal = beside || preferencesDock
      const travel = horizontal ? Math.abs(toX - fromX) : Math.abs(toY - fromY)
      const forward = horizontal ? Math.sign(toX - fromX) : Math.sign(toY - fromY)
      const across = horizontal ? Math.sign(toY - fromY) || 1 : Math.sign(toX - fromX) || 1
      const loopX = fromX + (toX - fromX) * visual.loopPosition
      const loopY = fromY + (toY - fromY) * visual.loopPosition
      const radiusAcross = Math.min(visual.loopWidth, Math.max(8, Math.abs(horizontal ? toY - fromY : toX - fromX) * 0.4))
      const radiusForward = Math.min(visual.loopHeight, travel * (preferencesDock ? 0.4 : 0.22))
      const point = (x: number, y: number) => horizontal
        ? `${loopX + y * radiusForward * forward} ${loopY + x * radiusAcross * across}`
        : `${loopX + x * radiusAcross * across} ${loopY + y * radiusForward * forward}`
      const approachFromBelow = iconFromBelow || preferencesDock
      const controlX = approachFromBelow ? toX : horizontal ? toX - forward * 14 : toX
      const controlY = approachFromBelow ? toY + 14 : horizontal ? toY : toY - forward * 14
      const tipDirection = Math.atan2(toY - controlY, toX - controlX)
      const stemX = toX - Math.cos(tipDirection) * 8
      const stemY = toY - Math.sin(tipDirection) * 8
      const leadX = horizontal ? fromX + forward * travel * 0.25 : fromX
      const leadY = horizontal ? fromY : fromY + forward * travel * 0.25
      let lasso = [
        `M ${fromX} ${fromY}`,
        `C ${leadX} ${leadY}, ${point(-0.8, -1)}, ${point(0, -1)}`,
        `C ${point(0.7, -1)}, ${point(1.1, -0.55)}, ${point(1, 0)}`,
        `C ${point(0.95, 0.7)}, ${point(0.5, 1)}, ${point(0, 1)}`,
        `C ${point(-0.7, 1)}, ${point(-1, 0.4)}, ${point(-1, 0)}`,
        `C ${point(-1, -0.65)}, ${point(-0.55, -1.05)}, ${point(0, -1)}`,
        `C ${point(1.2, -0.9)}, ${controlX} ${controlY}, ${stemX} ${stemY} L ${toX} ${toY}`,
      ].join(" ")
      if (preferencesDock) {
        const distance = fromY - toY
        lasso = `M ${fromX} ${fromY} C ${fromX} ${fromY - distance * 0.65}, ${toX} ${toY + distance * 0.45}, ${stemX} ${stemY} L ${toX} ${toY}`
      }
      setPlacement({
        cardLeft, cardTop, highlights,
        arrow: (horizontal || corridor >= 24) ? lasso : "",
      })
    }

    update()
    nextRef.current?.focus({ preventScroll: true })
    const observer = new ResizeObserver(update)
    observer.observe(card)
    if (target) observer.observe(target)
    regions.forEach((region) => observer.observe(region))
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    window.visualViewport?.addEventListener("resize", update)
    window.visualViewport?.addEventListener("scroll", update)
    // Follow the app’s initial entrance animations as well as layout changes.
    let frame = 0
    const start = performance.now()
    const follow = () => {
      update()
      if (performance.now() - start < 600) frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => {
      activeTargets.forEach((region) => region.classList.remove(styles.activeTarget))
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
      window.visualViewport?.removeEventListener("resize", update)
      window.visualViewport?.removeEventListener("scroll", update)
    }
  }, [open, current])

  if (!open) return null

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      className={styles.overlay}
      onCancel={(event) => { event.preventDefault(); onFinish() }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      {placement && (
        <svg aria-hidden="true" className={styles.dimming}>
          <defs>
            <mask id={spotlightId}>
              <rect width="100%" height="100%" fill="white" />
              {placement.highlights.map((region, index) => <rect key={index} x={region.left} y={region.top} width={region.width} height={region.height} fill="black" />)}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="black" fillOpacity="0.35" mask={`url(#${spotlightId})`} />
        </svg>
      )}
      {placement && (
        <svg aria-hidden="true" className={styles.arrows}>
          <defs>
            <marker id={arrowheadId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 L 2.5 5 Z" fill="var(--foreground)" stroke="none" />
            </marker>
          </defs>
          <path d={placement.arrow} markerEnd={placement.arrow ? `url(#${arrowheadId})` : undefined} />
        </svg>
      )}
      <div
        ref={cardRef}
        className={`${styles.card} bg-background text-foreground shadow-xl`}
        style={{ left: placement?.cardLeft ?? 12, top: placement?.cardTop ?? 12, visibility: placement ? "visible" : "hidden" }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs tracking-widest uppercase text-foreground/55">A quick tour · {step + 1} / {STEPS.length}</span>
          <button onClick={onFinish} aria-label="Skip tour" className={styles.iconButton}><X className="h-4 w-4" /></button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <div className="flex items-center gap-3 mb-2">
            <OnboardingAvatar dark={dark} />
            <h2 id="tour-title" className="text-lg font-medium tracking-tight">{current.title}</h2>
          </div>
          <p id="tour-description" className="text-sm leading-relaxed text-foreground/70">{current.text}</p>
        </div>
        <div className="flex gap-1.5 mt-5 mb-5" aria-hidden="true">
          {STEPS.map((item, index) => <span key={item.target} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-foreground/65" : "bg-foreground/15"}`} />)}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button onClick={onFinish} className={`${styles.textButton} text-foreground/60`}><X aria-hidden="true" className="h-3 w-3" /> Skip tour</button>
          <div className="flex items-center gap-2">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className={`${styles.textButton} disabled:opacity-25`}><ChevronLeft className="h-3.5 w-3.5" /> Back</button>
            <button ref={nextRef} onClick={() => step === STEPS.length - 1 ? onFinish() : setStep(step + 1)} className={`${styles.textButton} ${styles.nextButton}`}>
              {step === STEPS.length - 1 ? "Get started" : "Next"}<ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
