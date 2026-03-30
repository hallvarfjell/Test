// ============================================================================
// INTZ v11 – service-worker.js
//
// Offline-first caching for SPA.
// Trygg caching av alle statiske ressurser.
// ============================================================================

const CACHE_NAME = "intz-v11-cache-v1";

// ============================================================================
// FILES TO CACHE
// Legg inn alle filer som skal være tilgjengelige offline.
// ============================================================================

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",

  // CORE
  "./core/storage.js",
  "./core/time.js",
  "./core/ble.js",
  "./core/session.js",
  "./core/logger.js",
  "./core/graph.js",
  "./core/ui.js",

  // VIEWS
  "./views/dashboard.js",
  "./views/builder.js",
  "./views/results.js",
  "./views/log.js",
  "./views/settings.js",
  "./views/help.js",

  // SUPABASE LAYER
  "./supabase/client.js",
  "./supabase/sync.js",

  // STYLE
  "./css/style.css",

  // PWA
  "./manifest.json",

  // Icons through CDN (not cached here, but fine)
];

// ============================================================================
// INSTALL – cache alle filer
// ============================================================================

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// ============================================================================
// ACTIVATE – fjern gamle cacher
// ============================================================================

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ============================================================================
// FETCH – cache-first, network fallback
// ============================================================================

self.addEventListener("fetch", event => {
  const req = event.request;

  // Ikke cache POST/PUT/etc
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(cacheRes => {
      return (
        cacheRes ||
        fetch(req).catch(() =>
          // Dersom offline → fallback til index.html (SPA)
          req.mode === "navigate" ? caches.match("./index.html") : null
        )
      );
    })
  );
});
