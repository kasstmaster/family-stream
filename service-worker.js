// ==== ILYMMD+ Service Worker (snippet of patterns) ====
// Bump this on each release
const CACHE_NAME = "fs-v7";

// Never cache these (always from network)
const NO_CACHE_PATTERNS = [
  /\/manifest(\.v\d+)?\.json(\?.*)?$/i,
  /\/apple-touch-icon(\.v\d+)?\.(png|jpg|jpeg)(\?.*)?$/i,
  /\/favicon(\.v\d+)?\.(ico|png|svg)(\?.*)?$/i,
  /\/app-icon-(192|512)\.v\d+\.png(\?.*)?$/i
];

// --- Install ---
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// --- Activate ---
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Delete old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)));

    // Optional: enable navigation preload (faster first hit on Chrome)
    if ("navigationPreload" in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }

    // Take control immediately
    await self.clients.claim();

    // Only nudge a reload if we’re upgrading from a prior SW.
  const hadOldCaches = keys.some((key) => key !== CACHE_NAME);
  if (hadOldCaches) {
    const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsArr) {
      client.postMessage({ type: "SW_ACTIVATED_RELOAD" });
    }
  }
  })());
});

// --- Fetch ---
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache manifest/icons: always fetch fresh
  const dontCache = NO_CACHE_PATTERNS.some((re) => re.test(url.pathname + url.search));
  if (dontCache) {
    event.respondWith(fetch(req, { cache: "reload" }));
    return;
  }

  // For cross-origin (fonts, CDNs, etc.), just go to network
  if (!sameOrigin) {
    event.respondWith(fetch(req));
    return;
  }

  // Cache-first with background refresh for same-origin GETs
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    if (cached) {
      // Update in the background
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok && fresh.type === "basic") {
            await cache.put(req, fresh.clone());
          }
        } catch (_) { /* swallow */ }
      })());
      return cached;
    }

    // No cache: fetch and cache
    try {
      const resp = await fetch(req);
      if (resp && resp.ok && resp.type === "basic") {
        await cache.put(req, resp.clone());
      }
      return resp;
    } catch (err) {
      // Optional: return a fallback page/asset here if you have one
      return caches.match("/offline.html") || new Response("Offline", { status: 503 });
    }
  })());
});
