// ─── FoodChain Offline Service Worker ──────────────────────────
// Cache name — bump version to force re-cache on deploy
const CACHE = 'foodchain-v2';
const SW_BASE = self.location.href.substring(0, self.location.href.lastIndexOf('/') + 1);

// Install — skip waiting, don't fail on missing cache targets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      cache.add(new Request(SW_BASE + 'index.html', { cache: 'reload' })).catch(() => {});
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Helper: is this an API request to our backend?
function isApiRequest(url) {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/api/');
  } catch { return false; }
}

// Helper: is this a static asset (js, css, woff2, png, etc.)?
function isStaticAsset(url) {
  try {
    const u = new URL(url);
    const ext = u.pathname.split('.').pop() || '';
    return ['js', 'css', 'woff2', 'woff', 'ttf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'mp4', 'pdf'].includes(ext);
  } catch { return false; }
}

// Fetch — cache-first for assets, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // API requests — network first, cache fallback for GET, queue for mutations
  if (isApiRequest(url)) {
    if (request.method === 'GET') {
      event.respondWith(networkFirstCacheFallback(request));
    } else {
      // POST/PUT/DELETE — always try network
      event.respondWith(networkFirstNoCache(request));
    }
    return;
  }

  // Static assets — cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation / HTML — network first, fallback to cached index
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstCacheFallback(request));
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
});

// ─── Strategies ───────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match(SW_BASE + 'index.html');
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ error: 'Нет подключения к интернету', offline: true }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstNoCache(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'Нет подключения к интернету', offline: true }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}
