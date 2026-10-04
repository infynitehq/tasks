"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { ArrowRight } from "lucide-react"
import { OnboardingAvatar } from "./onboarding-avatar"
import styles from "./welcome-screen.module.css"

interface WelcomeScreenProps {
  open: boolean
  dark: boolean
  onStartTour: () => void
  onSkip: () => void
}

export function WelcomeScreen({ open, dark, onStartTour, onSkip }: WelcomeScreenProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.showModal()
    dialog?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`${styles.dialog} bg-background text-foreground outline-none`}
      onCancel={(event) => { event.preventDefault(); onSkip() }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"))
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <div className={styles.content}>
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/55">Welcome to Tasks</p>
        <div className={styles.avatar}><OnboardingAvatar size={192} dark={dark} /></div>
        <h1 id={titleId} className="text-3xl sm:text-4xl font-medium tracking-tight text-balance">Make room for<br />what matters.</h1>
        <p id={descriptionId} className="mt-4 text-sm leading-relaxed text-foreground/65 text-pretty">
          A little space for your day. Capture your tasks, find your focus, and take things one step at a time.
        </p>
        <div className="mt-8 mx-auto flex w-full max-w-56 flex-col items-stretch gap-2">
          <button onClick={onStartTour} className={`${styles.button} bg-foreground text-background`}>
            Explore <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <button onClick={onSkip} className={`${styles.button} text-foreground/65 hover:text-foreground`}>Skip intro</button>
        </div>
        <p className="mt-5 text-xs text-foreground/45">You can replay the tour anytime from the help button.</p>
      </div>
    </dialog>,
    document.body,
  )
}
