// Versioned cache name (bump this to clear old caches)
const CACHE_NAME = "fs-v4";

// Regex patterns for files we do NOT want to cache
const NO_CACHE_PATTERNS = [
  /\/manifest\.json(\?.*)?$/,
  /\/apple-touch-icon(\.[^?]+)?(\?.*)?$/,
  /\/favicon(\.[^?]+)?(\?.*)?$/,
  /\/web-app-manifest-\d+x\d+\.png(\?.*)?$/
];

// Install step
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate step
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Check if request matches NO_CACHE_PATTERNS
  const dontCache = NO_CACHE_PATTERNS.some((re) =>
    re.test(url.pathname + url.search)
  );

  if (dontCache) {
    // Always fetch fresh for icons/manifest
    event.respondWith(fetch(event.request, { cache: "reload" }));
    return;
  }

  // Default: cache-first with network fallback
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        // Return cached response, update in background
        event.waitUntil(
          fetch(event.request).then((res) => {
            if (res && res.ok && res.type === "basic") {
              cache.put(event.request, res.clone());
            }
          })
        );
        return cached;
      }
      // Otherwise go to network and cache it
      return fetch(event.request).then((res) => {
        if (res && res.ok && res.type === "basic") {
          cache.put(event.request, res.clone());
        }
        return res;
      });
    })
  );
});
