
const CACHE='intervall-cache-v26';
const ASSETS=['./','./index.html','./builder.html','./results.html','./log.html','./settings.html','./style.css','./main.js','./builder.js','./results.js','./manifest.json', './assets/favicon-16x16.png', './assets/favicon-32x32.png', './assets/apple-touch-icon.png', './assets/android-chrome-192x192.png', './assets/android-chrome-512x512.png', './assets/favicon.ico', './assets/favicon.svg', './assets/site.webmanifest'];
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate',e=>{ e.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))); await self.clients.claim(); })()); });
self.addEventListener('fetch',e=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
