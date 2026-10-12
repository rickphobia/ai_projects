import { describe, expect, it } from "vitest";

import {
  cacheName,
  cachePolicy,
  isOldShellCache,
} from "../../src/pwa/shell-cache";

const scope = "https://rickphobia.com/ai-projects/rss-news/";

function get(path: string, mode = "cors") {
  return { url: scope + path, method: "GET", mode };
}

describe("cachePolicy", () => {
  it("treats a navigation as the page", () => {
    expect(cachePolicy(get("", "navigate"), scope)).toBe("page");
  });

  it("caches built assets and icons", () => {
    expect(cachePolicy(get("assets/index-abc123.js"), scope)).toBe(
      "shell-file",
    );
    expect(cachePolicy(get("icons/icon-192.png"), scope)).toBe("shell-file");
  });

  it("never caches API answers or the health check", () => {
    expect(cachePolicy(get("api/session"), scope)).toBe("network-only");
    expect(cachePolicy(get("api/session", "navigate"), scope)).toBe(
      "network-only",
    );
    expect(cachePolicy(get("healthz"), scope)).toBe("network-only");
  });

  it("leaves anything but GET alone", () => {
    expect(cachePolicy({ ...get("assets/x.js"), method: "POST" }, scope)).toBe(
      "network-only",
    );
  });

  it("leaves requests outside the scope alone", () => {
    const other = {
      url: "https://rickphobia.com/ai-projects/other/",
      method: "GET",
      mode: "navigate",
    };
    expect(cachePolicy(other, scope)).toBe("network-only");
  });
});

describe("shell caches", () => {
  it("drops caches from other releases only", () => {
    expect(isOldShellCache(cacheName("old"), "new")).toBe(true);
    expect(isOldShellCache(cacheName("new"), "new")).toBe(false);
    expect(isOldShellCache("someone-else", "new")).toBe(false);
  });
});
