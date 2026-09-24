const RELEASE_VERSION = "0.3.1";
const CACHE_NAME = `pangmao-web-v${RELEASE_VERSION}`;

function versioned(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(RELEASE_VERSION)}`;
}

const APP_SHELL = [
  "./",
  "./index.html",
  versioned("./brand.json"),
  versioned("./styles.css"),
  versioned("./manifest.webmanifest"),
  versioned("./src/app.js"),
  versioned("./src/chinese-fallback.js"),
  versioned("./src/reader.js"),
  versioned("./src/release.js"),
  versioned("./src/search-engine.js"),
  versioned("./src/storage.js"),
  versioned("./src/tts.js"),
  versioned("./data/french-pack.json"),
  versioned("./data/chinese-fallback/manifest.json"),
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/deer-mascot.png",
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map(scopedUrl))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith("pangmao-web-") && name !== CACHE_NAME)
              .map((name) => caches.delete(name)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackPath = "") {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await caches.match(scopedUrl(fallbackPath));
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (url.searchParams.get("v") === RELEASE_VERSION) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // An unversioned request can only come from an older application shell.
  // Prefer the network so that old and new releases cannot be assembled together.
  event.respondWith(networkFirst(request));
});
