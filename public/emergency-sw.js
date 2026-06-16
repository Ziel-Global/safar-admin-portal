// Tiny offline cache for /tools/emergency and /guides/* pages.
// Keeps preview-iframe safety: scope is restricted via registration.

const CACHE = "safar-offline-v3";
const OFFLINE_PATHS = ["/tools/emergency", "/guides/umrah", "/guides/hajj"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_PATHS)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isPageRequest(url) {
  return (
    url.pathname.startsWith("/tools/emergency") ||
    url.pathname.startsWith("/guides/")
  );
}

// Same-origin built assets (JS/CSS/fonts/images) needed to boot the app shell
// so the cached HTML can actually render while offline.
function isAsset(req, url) {
  if (url.origin !== self.location.origin) return false;
  if (req.destination === "script" || req.destination === "style") return true;
  if (req.destination === "font" || req.destination === "image") return true;
  return /\.(js|mjs|css|woff2?|ttf|otf|png|jpe?g|svg|webp|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App-shell assets: cache-first, then network (and cache the result).
  if (isAsset(req, url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => null);
              return res;
            })
            .catch(() => cached),
      ),
    );
    return;
  }

  if (!isPageRequest(url)) return;

  // Pages: network-first, fall back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => null);
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (m) =>
            m ||
            (url.pathname.startsWith("/guides/")
              ? caches.match("/guides/" + url.pathname.split("/")[2])
              : caches.match("/tools/emergency")),
        ),
      ),
  );
});
