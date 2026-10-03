"use client"

import { useSyncExternalStore } from "react"
import { sync } from "@/lib/sync/manager"

export function useSync() {
  return useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot)
}
