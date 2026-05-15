const CACHE = 'eps-carnet-v2';
const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// Installation : mise en cache des ressources
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // On met en cache index.html en priorité, les autres en best-effort
      return cache.add('./index.html').then(function() {
        return Promise.allSettled(ASSETS.slice(1).map(function(url) {
          return cache.add(url).catch(function() {});
        }));
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) {
        return k !== CACHE;
      }).map(function(k) {
        return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// Fetch : Cache-first pour les assets, Network-first pour GitHub API
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // GitHub API : toujours réseau (pas de cache)
  if (url.includes('api.github.com')) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({error: 'offline'}), {
        headers: {'Content-Type': 'application/json'}
      });
    }));
    return;
  }

  // Google Fonts : cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(resp) {
          return caches.open(CACHE).then(function(cache) {
            cache.put(e.request, resp.clone());
            return resp;
          });
        }).catch(function() { return cached; });
      })
    );
    return;
  }

  // Tout le reste : Cache-first avec mise à jour en arrière-plan
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, resp.clone());
          });
        }
        return resp;
      }).catch(function() { return null; });

      return cached || fetchPromise;
    })
  );
});
