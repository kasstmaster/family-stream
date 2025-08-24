// ==== ILYMMD+ Service Worker ====
// Bump this to invalidate all old cached assets
const CACHE_NAME = "fs-v5";

// Files we NEVER cache (always fetch fresh)
const NO_CACHE_PATTERNS = [
  /\/manifest\.json(\?.*)?$/,
  /\/apple-touch-icon(\.[^?]+)?(\?.*)?$/,
  /\/favicon(\.[^?]+)?(\?.*)?$/,
  /\/web-app-manifest-\d+x\d+\.png(\?.*)?$/ // 192x192, 512x512, etc.
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

    // Tell all pages to reload once (so users pick up new assets)
    const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsArr) {
      client.postMessage({ type: "SW_ACTIVATED_RELOAD" });
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
