import "server-only"

export function isSameOriginRequest(request: Request): boolean {
  const url = new URL(request.url)
  // Next dev may expose its bind address (0.0.0.0) in request.url. Host is
  // the actual HTTP authority; do not substitute arbitrary forwarded headers.
  const host = request.headers.get("host")
  const expectedOrigin = host ? `${url.protocol}//${host}` : url.origin
  return request.headers.get("origin") === expectedOrigin && request.headers.get("sec-fetch-site") !== "cross-site"
}
