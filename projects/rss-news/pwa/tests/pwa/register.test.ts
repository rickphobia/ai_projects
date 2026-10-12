import { describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "../../src/pwa/register";

const base = "https://rickphobia.com/ai-projects/rss-news/";

function fakeContainer(
  register: ServiceWorkerContainer["register"],
): ServiceWorkerContainer {
  return { register } as unknown as ServiceWorkerContainer;
}

describe("registerServiceWorker", () => {
  it("registers sw.js scoped to the path prefix", () => {
    const register = vi.fn(() =>
      Promise.resolve({} as ServiceWorkerRegistration),
    );
    registerServiceWorker(fakeContainer(register), base, vi.fn());
    expect(register).toHaveBeenCalledWith(new URL("sw.js", base), {
      scope: base,
    });
  });

  it("reports a failed registration instead of throwing", async () => {
    const onError = vi.fn();
    registerServiceWorker(
      fakeContainer(() => Promise.reject(new Error("blocked"))),
      base,
      onError,
    );
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  it("does nothing where service workers aren't supported", () => {
    expect(() => {
      registerServiceWorker(undefined, base, vi.fn());
    }).not.toThrow();
  });
});
