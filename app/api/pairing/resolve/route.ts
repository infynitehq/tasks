import { handlePairingRequest } from "@/lib/server/pairing-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15

export function POST(request: Request) {
  return handlePairingRequest(request, "resolve")
}
