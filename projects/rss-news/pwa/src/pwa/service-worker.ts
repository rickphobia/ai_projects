/// <reference lib="webworker" />
// Built to sw.js at the root of the build (see vite.config.ts), so its scope is the path prefix.
// Each build gets a new __BUILD_ID__, so the browser sees a changed worker on the next open,
// installs it straight away and drops the previous release's cache.
import { cacheName, cachePolicy, isOldShellCache } from "./shell-cache";

declare const self: ServiceWorkerGlobalScope;

const shellCache = cacheName(__BUILD_ID__);
const precached = [
  "./",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(shellCache)
      .then((cache) => cache.addAll(precached))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => isOldShellCache(name, __BUILD_ID__))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const policy = cachePolicy(event.request, self.registration.scope);
  if (policy === "page") event.respondWith(networkFirst(event.request));
  if (policy === "shell-file") event.respondWith(cacheFirst(event.request));
});

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(shellCache);
  try {
    const response = await fetch(request);
    // Every navigation renders the same shell, so keep it under one key for offline opens.
    if (response.ok) await cache.put("./", response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match("./");
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(shellCache);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
