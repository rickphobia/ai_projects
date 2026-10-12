// Registers the service worker that makes the app installable and opens the shell offline.
// A failure is reported, not thrown: the app still works online without it.
export function registerServiceWorker(
  container: ServiceWorkerContainer | undefined,
  baseUrl: string,
  onError: (error: Error) => void,
): void {
  if (!container) return;
  const scope = new URL("./", baseUrl).href;
  container
    .register(new URL("sw.js", scope), { scope })
    .catch((cause: unknown) => {
      onError(
        new Error(`Couldn't register the service worker at ${scope}sw.js`, {
          cause,
        }),
      );
    });
}
