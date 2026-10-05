// service-worker.js
// INTZ v10.1 – Oppdatert SPA-cache.

const CACHE =
  "intervall-cache-v101-sync-v3";

const APP_ASSETS = [
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
          cache.addAll(APP_ASSETS)
        )
    );
  }
);

self.addEventListener(
  "activate",
  event => {
    event.waitUntil(
      (async () => {
        const cacheNames =
          await caches.keys();

        await Promise.all(
          cacheNames
            .filter(
              name =>
                name !== CACHE
            )
            .map(
              name =>
                caches.delete(name)
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
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    const sameOrigin =
      url.origin ===
      self.location.origin;

    if (sameOrigin) {
      event.respondWith(
        (async () => {
          try {
            const response =
              await fetch(request);

            if (
              response &&
              response.ok
            ) {
              const cache =
                await caches.open(
                  CACHE
                );

              cache.put(
                request,
                response.clone()
              );
            }

            return response;
          } catch {
            const cached =
              await caches.match(
                request
              );

            if (cached) {
              return cached;
            }

            throw new Error(
              "Ressursen er ikke tilgjengelig offline."
            );
          }
        })()
      );

      return;
    }

    event.respondWith(
      (async () => {
        const cached =
          await caches.match(
            request
          );

        if (cached) {
          return cached;
        }

        return fetch(request);
      })()
    );
  }
);