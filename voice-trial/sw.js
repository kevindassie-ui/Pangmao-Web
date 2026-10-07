import { withByteRange } from "./ranges.js";
import { TRIAL_VERSION } from "./player.js";

const CACHE = `pangmao-voice-trial-${TRIAL_VERSION}`;
const ROOT = self.registration.scope;
const SHELL = ["./", "./index.html", "./styles.css", "./controller.js", "./player.js", "./ranges.js", "./manifest.json", "./NOTICE.md"];
const shellUrls = new Set(SHELL.map((path) => new URL(path, ROOT).href));
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...shellUrls])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("pangmao-voice-trial-") && name !== CACHE).map((name) => caches.delete(name)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(ROOT)) return;
  const url = new URL(request.url);
  const path = url.pathname.slice(new URL(ROOT).pathname.length);
  const isAudio = /^audio\/(female|male)-(avocat|medecin|liaisons|nombres|quotidien|lecture)\.mp3$/.test(path);
  if (!isAudio && !shellUrls.has(url.origin + url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.origin + url.pathname; // Exactly 12 bounded audio entries.
    let response = await cache.match(key);
    if (!response) {
      // Fetch the complete file even if the media element requested a range.
      response = await fetch(key);
      if (response.status === 200 && (!isAudio || (await response.clone().arrayBuffer()).byteLength <= 250_000)) await cache.put(key, response.clone());
    }
    return isAudio && response.status === 200 ? withByteRange(response, request.headers.get("Range")) : response;
  })());
});
