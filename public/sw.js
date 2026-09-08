// Mehar DVR Progressive Web App (PWA) Service Worker
const CACHE_NAME = "mehar-dvr-v1.0.0";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/favicon.png",
  "/logo.svg",
  "/robots.txt",
];

// 1. Install event: pre-cache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate event: purge outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate for static assets, Network-First for APIs
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or chrome-extension URLs
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // API calls & dynamic auth routes: Always Network First
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/health")) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(
              JSON.stringify({ error: "Offline: Network unavailable" }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            )
        )
      )
    );
    return;
  }

  // Static Assets (scripts, CSS, fonts, images): Cache First / Stale While Revalidate
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Page Navigation: Network First with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Default fetch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// 4. Message event: support instant updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
