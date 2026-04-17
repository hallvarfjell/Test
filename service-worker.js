// service-worker.js
// INTZ v10.1 – SPA cache
const CACHE='intervall-cache-v101-spa';
const ASSETS=[
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './spa-router.js',
  './supabase-client.js',
  './cloud-sync.js',
  './settings-core.js',
  './settings-view.js',
  './log-view.js',
  './main.js',
  './builder.js',
  './results.js'
];

self.addEventListener('install', (e)=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
