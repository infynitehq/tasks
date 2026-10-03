"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Heart, Link } from "lucide-react"
import { OnboardingAvatar } from "./onboarding-avatar"

interface AboutScreenProps {
  open: boolean
  dark: boolean
  onClose: () => void
}

export function AboutScreen({ open, dark, onClose }: AboutScreenProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-background p-0 text-foreground backdrop:bg-background"
      onCancel={(event) => { event.preventDefault(); onClose() }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:740px)]:pt-1 [@media(max-height:740px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))] [@media(min-height:860px)]:pt-4 [@media(min-height:860px)]:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col justify-center gap-[clamp(0.25rem,calc((100dvh-640px)/10),1.25rem)] py-[clamp(0.25rem,calc((100dvh-640px)/20),1rem)]">
          <header className="border-b border-foreground/10 pb-5 [@media(max-height:740px)]:pb-2 [@media(min-height:860px)]:pb-7">
            <div className="mb-4 flex items-center justify-start [@media(max-height:740px)]:mb-1">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to tasks"
                className="flex min-h-9 items-center gap-1.5 rounded text-sm text-foreground/50 dark:text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
              </button>
            </div>
            <h1 id={titleId} className="text-3xl font-medium tracking-tight text-foreground/90">About Tasks<span className="text-foreground/35 dark:text-foreground/65">.</span></h1>
            <p id={descriptionId} className="mt-3 max-w-sm text-sm leading-relaxed text-foreground/60 dark:text-foreground/80 [@media(max-height:740px)]:mt-2 [@media(max-height:740px)]:leading-5">
              A minimal daily todo app to capture tasks and track your progress. Local-first by design, your tasks stay on your devices — never on our servers — and sync between them using WebRTC.
              <br />
              <br />
              Check it out at{" "}
              <a href="https://github.com/infynitehq/tasks" target="_blank" rel="noopener noreferrer" className="rounded underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">github.com/infynitehq/tasks</a>.
            </p>
          </header>
            <div className="flex items-center gap-4 [@media(min-height:760px)]:gap-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center [&>div]:!h-32 [&>div]:!w-32 [&_svg]:h-full [&_svg]:w-full [@media(min-height:760px)]:h-28 [@media(min-height:760px)]:w-28 [@media(min-height:760px)]:[&>div]:!h-40 [@media(min-height:760px)]:[&>div]:!w-40">
                <OnboardingAvatar size={160} dark={dark} />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-base font-medium text-foreground/75 dark:text-foreground/85">Hey, I’m</p>
                <h2 className="text-3xl leading-tight font-bold tracking-tight text-foreground [@media(min-height:760px)]:text-[2rem]">Soham Datta.</h2>
                <div className="-mt-1 flex flex-wrap items-center gap-x-1 gap-y-0 text-foreground/65 dark:text-foreground/80">
                  <a href="https://x.com/tech_savvy_guy_" target="_blank" rel="noopener noreferrer" aria-label="@tech_savvy_guy_ on X (Twitter)" className="mr-1 flex min-h-9 items-center rounded text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
                    @tech_savvy_guy_
                  </a>
                  <a href="https://github.com/tech-savvy-guy" target="_blank" rel="noopener noreferrer" aria-label="GitHub profile" title="GitHub profile" className="flex h-9 w-9 items-center justify-center transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.087-.744.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.045.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.628-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                    </svg>
                  </a>
                  <a href="https://sohamdatta.com/" target="_blank" rel="noopener noreferrer" aria-label="Personal website" title="Personal website" className="flex h-9 w-9 items-center justify-center transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
                    <Link aria-hidden="true" className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
            <p className="text-[clamp(1.5rem,6.5vw,1.875rem)] leading-tight font-medium tracking-tight text-foreground/90 [@media(min-height:760px)]:text-[clamp(1.5rem,7.5vw,2.25rem)]">
              Serious about software.<br />
              <span className="text-foreground/45 dark:text-foreground/75">Not about myself.</span>
            </p>
          <div>
            <p className="max-w-sm text-sm leading-relaxed text-foreground/65 dark:text-foreground/80 [@media(max-height:740px)]:leading-5 [@media(min-height:860px)]:text-base">
              I build thoughtful little tools for everyday life. Tasks is one of them — a small space for everything on your mind.
            </p>
          </div>
        </div>

        <footer className="shrink-0 border-t border-foreground/10 pt-4 [@media(max-height:740px)]:pt-2 [@media(min-height:860px)]:pt-5">
          <section aria-labelledby={`${titleId}-contact`}>
            <h3 id={`${titleId}-contact`} className="text-base font-medium tracking-tight text-foreground/85">Bugs, ideas, or a friendly hello?</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/55 dark:text-foreground/80 [@media(max-height:740px)]:leading-5">My inbox accepts all three. There’s a friendly nerd on the other end! 🤓</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65 dark:text-foreground/80 [@media(max-height:740px)]:mt-1">
              Reach out to me at{" "}
              <a href="mailto:dattasoham805@gmail.com" className="rounded underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">dattasoham805@gmail.com</a>.
            </p>
          </section>
          <a href="https://github.com/sponsors/tech-savvy-guy" target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground/85 px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background [@media(max-height:740px)]:mt-2">
            <Heart aria-hidden="true" className="h-4 w-4" /> Sponsor my work
          </a>
        </footer>
      </div>
    </dialog>,
    document.body,
  )
}
