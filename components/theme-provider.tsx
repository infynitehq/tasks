"use client"

import { useEffect, type ComponentProps } from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { getMeta } from "@/lib/idb"

const storageKey = "theme"

function MigrateThemePreference() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let active = true

    async function migrate() {
      try {
        if (localStorage.getItem(storageKey) !== null) return
        const savedDark = await getMeta<boolean>("theme")
        // Do not overwrite a selection made while IndexedDB was loading.
        if (active && typeof savedDark === "boolean" && localStorage.getItem(storageKey) === null) {
          setTheme(savedDark ? "dark" : "light")
        }
      } catch {
        // Storage may be unavailable; next-themes still handles the active theme.
      }
    }

    void migrate()
    return () => { active = false }
  }, [setTheme])

  return null
}

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props} storageKey={storageKey}>
      <MigrateThemePreference />
      {children}
    </NextThemesProvider>
  )
}
