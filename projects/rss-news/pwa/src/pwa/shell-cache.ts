// Which requests the service worker may answer from its cache. Only the app shell (the page,
// its built files and icons) is ever cached: API answers and /healthz are the owner's data or
// live state, so they always go to the network.

export type CachePolicy =
  // The page itself: network first so a new release shows on the next open, cache when offline.
  | "page"
  // Files under the scope that hold no data. Built assets carry a content hash in their name.
  | "shell-file"
  // Never touched by the worker.
  | "network-only";

export interface ShellRequest {
  url: string;
  method: string;
  mode: string;
}

const neverCached = ["api/", "healthz"];

export function cachePolicy(request: ShellRequest, scope: string): CachePolicy {
  if (request.method !== "GET") return "network-only";
  if (!request.url.startsWith(scope)) return "network-only";
  const path = new URL(request.url).pathname.slice(
    new URL(scope).pathname.length,
  );
  if (neverCached.some((prefix) => path.startsWith(prefix)))
    return "network-only";
  if (request.mode === "navigate") return "page";
  return "shell-file";
}

// One cache per release, so activating a new worker can drop every older release's files.
export function cacheName(buildId: string): string {
  return `rss-news-shell-${buildId}`;
}

export function isOldShellCache(name: string, buildId: string): boolean {
  return name.startsWith("rss-news-shell-") && name !== cacheName(buildId);
}
