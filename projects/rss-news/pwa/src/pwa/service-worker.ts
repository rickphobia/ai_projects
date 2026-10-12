/// <reference lib="webworker" />
// Built to sw.js at the root of the build (see vite.config.ts), so its scope is the path prefix.
// Each build gets a new __BUILD_ID__, so the browser sees a changed worker on the next open,
// installs it straight away and drops the previous release's cache.
// It is a classic script, so it can't load chunks: import only modules the app doesn't import,
// or the build splits them out into an `import` that stops the worker from starting.
import { alertFromPushData, alertPageUrl } from "./alert-message";
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

// An Alert from the server: show it, remembering the page that tapping it opens.
self.addEventListener("push", (event) => {
  const alert = alertFromPushData(event.data?.text() ?? null);
  event.waitUntil(
    self.registration.showNotification(alert.title, {
      body: alert.body,
      icon: "icons/icon-192.png",
      data: { url: alertPageUrl(alert.itemId, self.registration.scope) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url } = event.notification.data as { url: string };
  event.waitUntil(openPage(url));
});

// Reuses an open window of the app when there is one, so the phone doesn't stack copies.
async function openPage(url: string): Promise<void> {
  const windows = await self.clients.matchAll({ type: "window" });
  const open = windows[0];
  if (open) {
    const moved = await open.navigate(url);
    await (moved ?? open).focus();
    return;
  }
  await self.clients.openWindow(url);
}

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
