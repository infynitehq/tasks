import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { turnCredentials, TURN_TTL_SECONDS } from "../lib/turn.ts"

test("TURN REST credentials have the expected expiry and coturn-compatible signature", () => {
  const now = 1_800_000_000_000
  const config = turnCredentials({ TURN_URLS: "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:443?transport=tcp", TURN_SHARED_SECRET: "test-secret" }, now)
  const server = config.iceServers[0]!
  assert.equal(config.expiresAt, now + TURN_TTL_SECONDS * 1000)
  assert.equal(Number(server.username.split(":")[0]) * 1000, config.expiresAt)
  assert.equal(server.credential, createHmac("sha1", "test-secret").update(server.username).digest("base64"))
  assert.equal(server.urls.length, 2)
  assert.ok(!JSON.stringify(config).includes("test-secret"))
})

test("unconfigured TURN is optional, but partial or invalid configuration fails", () => {
  assert.deepEqual(turnCredentials({}), { iceServers: [], expiresAt: null })
  assert.throws(() => turnCredentials({ TURN_URLS: "turn:example.com:3478" }))
  assert.throws(() => turnCredentials({ TURN_SHARED_SECRET: "secret" }))
  for (const url of [",", "https://example.com", "turn:user:password@example.com:3478", "turn:example.com:3478#fragment"]) {
    assert.throws(() => turnCredentials({ TURN_URLS: url, TURN_SHARED_SECRET: "secret" }))
  }
})
