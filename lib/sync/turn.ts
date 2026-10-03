interface TurnConfig {
  iceServers: RTCIceServer[]
  expiresAt: number | null
}

let cached: TurnConfig | null = null
let pending: Promise<TurnConfig> | null = null

export async function getTurnConfig(): Promise<TurnConfig> {
  // Leave at least 55 minutes of validity for each newly joined room.
  if (cached?.expiresAt && cached.expiresAt > Date.now() + 55 * 60_000) return cached
  if (!pending) {
    pending = fetch("/api/turn", {
      method: "POST", cache: "no-store", credentials: "same-origin",
      signal: AbortSignal.timeout(10_000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`TURN credentials unavailable (${response.status})`)
      const config = await response.json() as TurnConfig
      if (!Array.isArray(config.iceServers) ||
          (config.iceServers.length > 0 && (typeof config.expiresAt !== "number" || config.expiresAt <= Date.now()))) {
        throw new Error("Invalid TURN credentials response")
      }
      cached = config
      return config
    }).finally(() => { pending = null })
  }
  return pending
}
