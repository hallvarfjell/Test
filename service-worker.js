const CACHE = 'intz-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './components/ui.js',
  './components/storage.js',
  './components/graph.js',
  './components/bt.js',
  './components/pi.js',
  './modules/dashboard.js',
  './modules/okt.js',
  './modules/sim.js',
  './modules/resultat.js',
  './modules/statistikk.js',
  './modules/innstillinger.js',
  './modules/logg.js',
  './assets/logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
