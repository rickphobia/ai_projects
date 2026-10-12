import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HttpApiClient,
  RefusedError,
  SignedOutError,
} from "../../src/api/client";

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

  it("asks for an Inbox page by Folder and cursor and reads it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      answer(200, {
        items: [
          {
            id: 7,
            title: "A story",
            url: "https://news.example/7",
            source: "Example",
            folder: { id: 2, name: "World" },
            published_at: "2026-10-12T04:00:00+00:00",
            importance: 4,
            summary: "Something happened.",
            read: false,
            image_url: "https://img.example/7.jpg",
            stocks: ["NVDA"],
          },
        ],
        next_cursor: "2026-10-12T04:00:00+00:00~7",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await new HttpApiClient(BASE, () => undefined).inbox({
      folderId: 2,
      minImportance: 3,
      sort: "importance",
      search: "gemma weights",
      cursor: "2026-10-12T05:00:00+00:00~9",
    });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/ai-projects/rss-news/api/inbox");
    expect(url.searchParams.get("folder")).toBe("2");
    expect(url.searchParams.get("min_importance")).toBe("3");
    expect(url.searchParams.get("sort")).toBe("importance");
    expect(url.searchParams.get("search")).toBe("gemma weights");
    expect(url.searchParams.get("cursor")).toBe("2026-10-12T05:00:00+00:00~9");
    expect(page).toEqual({
      items: [
        {
          id: 7,
          title: "A story",
          url: "https://news.example/7",
          source: "Example",
          folder: { id: 2, name: "World" },
          publishedAt: "2026-10-12T04:00:00+00:00",
          importance: 4,
          summary: "Something happened.",
          read: false,
          imageUrl: "https://img.example/7.jpg",
          stocks: ["NVDA"],
        },
      ],
      nextCursor: "2026-10-12T04:00:00+00:00~7",
    });
  });

  it("asks for the whole Inbox without a query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(answer(200, { items: [], next_cursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await new HttpApiClient(BASE, () => undefined).inbox({});

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.href).toBe(`${BASE}api/inbox`);
  });

  it("lists the Folders", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(answer(200, { folders: [{ id: 1, name: "AI" }] })),
    );

    const folders = await new HttpApiClient(BASE, () => undefined).folders();

    expect(folders).toEqual([{ id: 1, name: "AI" }]);
  });

  it("adds a subreddit with the backend's field names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      answer(201, {
        id: 3,
        folder_id: 1,
        name: "r/LocalLLaMA",
        url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day",
        paused: false,
        last_success_at: null,
        last_error_at: null,
        last_error: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const added = await new HttpApiClient(BASE, () => undefined).addSource({
      folderId: 1,
      subreddit: "LocalLLaMA",
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/sources`);
    expect(init.body).toBe(
      JSON.stringify({ folder_id: 1, subreddit: "LocalLLaMA" }),
    );
    expect(added.folderId).toBe(1);
    expect(added.name).toBe("r/LocalLLaMA");
  });

  it("turns a refusal into a RefusedError with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          answer(409, { detail: "the Folder still has 2 Source(s)" }),
        ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).deleteFolder(4),
    ).rejects.toEqual(new RefusedError("the Folder still has 2 Source(s)"));
  });

  it("asks for one Item's Reader view", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(answer(200, { title: "A story", text: "One.\nTwo." }));
    vi.stubGlobal("fetch", fetchMock);

    const view = await new HttpApiClient(BASE, () => undefined).readerView(7);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/ai-projects/rss-news/api/items/7/reader");
    expect(view).toEqual({ title: "A story", text: "One.\nTwo." });
  });

  it("turns a Reader view failure into a RefusedError for the owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          answer(502, { detail: "Reader view isn't available: HTTP 403." }),
        ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).readerView(7),
    ).rejects.toEqual(
      new RefusedError("Reader view isn't available: HTTP 403."),
    );
  });
});
