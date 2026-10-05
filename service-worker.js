// service-worker.js
// INTZ v10.1 – SPA cache med oppdatert synkronisering

const CACHE =
  "intervall-cache-v101-sync-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./spa-router.js",
  "./supabase-client.js",
  "./cloud-sync.js",
  "./settings-core.js",
  "./settings-view.js",
  "./log-view.js",
  "./main.js",
  "./builder.js",
  "./results.js"
];

self.addEventListener(
  "install",
  event => {
    self.skipWaiting();

    event.waitUntil(
      caches
        .open(CACHE)
        .then(cache =>
          cache.addAll(ASSETS)
        )
    );
  }
);

self.addEventListener(
  "activate",
  event => {
    event.waitUntil(
      (async () => {
        const keys =
          await caches.keys();

        await Promise.all(
          keys
            .filter(
              key => key !== CACHE
            )
            .map(
              key =>
                caches.delete(key)
            )
        );

        await self.clients.claim();
      })()
    );
  }
);

self.addEventListener(
  "fetch",
  event => {
    const request = event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    event.respondWith(
      (async () => {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        try {
          return await fetch(request);
        } catch (error) {
          console.warn(
            "[INTZ SW] Nettverksforespørsel feilet:",
            request.url,
            error
          );

          throw error;
        }
      })()
    );
  }
);