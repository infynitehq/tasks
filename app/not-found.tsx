"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { ArrowLeft } from "lucide-react"
import { OnboardingAvatar } from "@/components/onboarding-avatar"

export default function NotFound() {
  const { resolvedTheme } = useTheme()

  return (
    <main className="h-dvh overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
        <p className="mb-6 text-xs uppercase tracking-[0.2em] text-foreground/50">404 · Page not found</p>
        <OnboardingAvatar size={160} dark={resolvedTheme === "dark"} mood="sad" />
        <h1 className="mt-6 text-3xl font-medium tracking-tight">A little lost.</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground/60">
          This page isn’t here. Let’s get you back to your day.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to tasks
        </Link>
      </div>
    </main>
  )
}
