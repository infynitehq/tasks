import { turnCredentials } from "@/lib/turn"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Best-effort per-instance backstop. Use a Vercel Firewall rate-limit rule for
// enforcement across serverless instances; this app has no user accounts.
const requests = new Map<string, { count: number; reset: number }>()
const headers = { "Cache-Control": "no-store", Vary: "Origin" }

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Same-origin request required" }, { status: 403, headers })
  }
  const now = Date.now()
  for (const [key, value] of requests) if (value.reset <= now) requests.delete(key)
  // Vercel overwrites this header. Do not trust arbitrary forwarded IP headers.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") ?? "unknown" : "local"
  const entry = requests.get(ip) ?? { count: 0, reset: now + 60_000 }
  if (entry.count >= 20 || (!requests.has(ip) && requests.size >= 10_000)) {
    return Response.json({ error: "Too many requests" }, {
      status: 429, headers: { ...headers, "Retry-After": "60" },
    })
  }
  entry.count++
  requests.set(ip, entry)
  try {
    return Response.json(turnCredentials(process.env), { headers })
  } catch {
    return Response.json({ error: "TURN is misconfigured on the server" }, { status: 503, headers })
  }
}
