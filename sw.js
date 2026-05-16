/*
  DOWNRANGE DIGITAL — Service Worker
  © 2026 My Realm Creations — B.S.B. All Rights Reserved.

  Strategy: Cache-First for all app resources.
  - On install: pre-cache the app shell (HTML + fonts)
  - On fetch: serve from cache instantly, revalidate in background
  - On activate: purge old cache versions
  - Offline: serve cached version seamlessly — no network needed at the range
*/

const CACHE_NAME = 'dd-v2-5-4';
const CACHE_URLS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@400;500&family=Rajdhani:wght@600;700&family=Russo+One&display=swap',
];

// ── INSTALL: pre-cache app shell ──────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache what we can — don't fail install if a font CDN is unreachable
      return Promise.allSettled(
        CACHE_URLS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Could not pre-cache:', url, err);
          });
        })
      );
    }).then(function() {
      // Take control immediately — don't wait for old SW to expire
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean up old cache versions ────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) {
              console.log('[SW] Purging old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(function() {
      // Claim all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── FETCH: cache-first with background revalidation ──────
self.addEventListener('fetch', function(e) {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // Skip cross-origin requests that aren't fonts
  var url = new URL(e.request.url);
  var isSameOrigin = url.origin === self.location.origin;
  var isFont = url.hostname === 'fonts.googleapis.com' ||
               url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isFont) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        // Fetch fresh copy in background to keep cache warm
        var networkFetch = fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(function() {
          // Network failed — that's fine, we have the cache
          return null;
        });

        // Serve cache instantly if available, otherwise wait for network
        return cached || networkFetch;
      });
    })
  );
});

// ── MESSAGE: force update from app ───────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
