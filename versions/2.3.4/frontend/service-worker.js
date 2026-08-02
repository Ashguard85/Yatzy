const CACHE_NAME = 'yatzy-duell-2.3.4';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png','./icons/favicon-16.png','./badges/games.png','./badges/wins.png','./badges/yatzys.png','./badges/bonus.png','./badges/no-strike.png','./badges/full-house.png','./badges/small-straight.png','./badges/large-straight.png','./badges/yatzy-1.png','./badges/yatzy-2.png','./badges/yatzy-3.png','./badges/yatzy-4.png','./badges/yatzy-5.png','./badges/yatzy-6.png','./badges/rainbow.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)); return response; }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;})));
});
