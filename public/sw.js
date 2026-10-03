// Self-destructing service worker.
// A previous cache-first version served stale chunks (the Flame import error).
// This version unregisters itself and wipes every cache so any browser that
// still has it installed gets cleaned up automatically on next load.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  )
})

// Never intercept — always go straight to the network.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
