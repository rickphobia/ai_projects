import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpApiClient, SignedOutError } from "../../src/api/client";

const BASE = "https://example.test/ai-projects/rss-news/";

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in with the password as JSON, sending cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer(204));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HttpApiClient(BASE, () => undefined).login("pw");

    expect(result).toEqual({ kind: "signed-in" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/login`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe(JSON.stringify({ password: "pw" }));
  });

  it("tells a wrong password from a lockout", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(answer(401, { detail: "Wrong password." }))
        .mockResolvedValueOnce(answer(429, { minutes_left: 7 })),
    );
    const api = new HttpApiClient(BASE, () => undefined);

    expect(await api.login("a")).toEqual({ kind: "wrong-password" });
    expect(await api.login("b")).toEqual({
      kind: "locked-out",
      minutesLeft: 7,
    });
  });

  it("sends the owner to login when a call answers 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(401)));
    const onSignedOut = vi.fn();

    await expect(
      new HttpApiClient(BASE, onSignedOut).checkSession(),
    ).rejects.toBeInstanceOf(SignedOutError);
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it("doesn't send the owner to login while signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(204)));
    const onSignedOut = vi.fn();

    await new HttpApiClient(BASE, onSignedOut).checkSession();

    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
