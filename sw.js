const CACHE = 'intz-cache-v3';
const ASSETS = [
  'index.html', 'styles.css', 'main.js', 'manifest.webmanifest',
  'assets/logo.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'js/router.js','js/store.js','js/ble.js','js/helpers.js',
  'js/modules/dashboard.js','js/modules/editor.js','js/modules/workout.js','js/modules/simulator.js','js/modules/results.js','js/modules/stats.js','js/modules/settings.js','js/modules/log.js'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE && caches.delete(k)))) ); });
self.addEventListener('fetch', e => { const url=new URL(e.request.url); if(url.origin===location.origin){ e.respondWith(caches.match(e.request).then(res => res || fetch(e.request))); } });
