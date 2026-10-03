import type { SyncState } from "./manager"

export type SyncStatusKind = "setup" | "connecting" | "syncing" | "synced" | "waiting" | "error"

/** User-facing status is based on matching data, never just a joined room. */
export function syncSummary(state: SyncState): { kind: SyncStatusKind; label: string; title: string; detail: string } {
  if (!state.ready) return { kind: "connecting", label: "Getting ready", title: "Getting things ready", detail: "Checking your devices…" }
  if (state.error) return { kind: "error", label: "Sync needs attention", title: "Let’s get you connected", detail: state.error }
  const devices = state.devices.filter((d) => d.deviceId !== state.me.deviceId)
  if (!state.enabled || !devices.length) return {
    kind: "setup", label: "Sync devices", title: "Your tasks, together",
    detail: "Pick up where you left off on your phone, tablet, or computer.",
  }
  if (!state.connected) return {
    kind: "connecting", label: "Connecting", title: "Finding your devices",
    detail: "Keep tasks open on both devices and check that they’re connected to the internet.",
  }
  if (state.online.some((peer) => !peer.synced)) return {
    kind: "syncing", label: "Syncing", title: "Bringing your tasks together",
    detail: "Keep both apps open. We’ll confirm here when your tasks match.",
  }
  const offline = devices.filter((d) => !state.online.some((p) => p.deviceId === d.deviceId))
  if (!offline.length && state.online.length) return {
    kind: "synced", label: "Up to date", title: "Everything’s up to date",
    detail: state.online.length === 1
      ? `Your tasks match on this device and ${state.online[0].name}.`
      : `Your tasks match across this device and ${state.online.length} other devices.`,
  }
  const pending = offline.some((d) => d.pending)
  return {
    kind: "waiting", label: pending ? "Changes waiting" : "Waiting for device",
    title: pending ? "Changes waiting to sync" : "Ready when you are",
    detail: offline.length === 1
      ? `Open Tasks on ${offline[0].name} to ${pending ? "share your latest changes" : "check for updates"}.`
      : "Open Tasks on your other devices to bring everything up to date.",
  }
}
