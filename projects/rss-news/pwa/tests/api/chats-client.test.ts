import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatSearch } from "../../src/api/chats";
import { HttpApiClient, RefusedError } from "../../src/api/client";

const BASE = "https://example.test/ai-projects/rss-news/";

const SUMMARY_JSON = {
  id: 4,
  title: "What happened in Malaysia",
  created_at: "2026-10-12T09:00:00+00:00",
  updated_at: "2026-10-12T09:05:00+00:00",
  cost_usd: "0.08",
};

const ANSWER_JSON = {
  id: 12,
  role: "assistant",
  created_at: "2026-10-12T09:05:00+00:00",
  text: "In the last 24 hours, 2 Items mention Malaysia.",
  items: [
    { id: 7, title: "Budget day", source: "The Star", summary: "A summary." },
  ],
};

// A server-sent event stream arriving in chunks that split events and lines.
function eventStream(text: string, chunkSize: number): Response {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let start = 0; start < bytes.length; start += chunkSize) {
        controller.enqueue(bytes.slice(start, start + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function event(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("HttpApiClient Chats", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the Chats, creates one and reads one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ chats: [SUMMARY_JSON] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ chat: { ...SUMMARY_JSON, messages: [] } }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            chat: { ...SUMMARY_JSON, messages: [ANSWER_JSON] },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient(BASE, () => undefined);

    const listed = await client.chats();
    const created = await client.createChat();
    const opened = await client.chat(4);

    expect(listed).toEqual([
      {
        id: 4,
        title: "What happened in Malaysia",
        createdAt: "2026-10-12T09:00:00+00:00",
        updatedAt: "2026-10-12T09:05:00+00:00",
        costUsd: "0.08",
      },
    ]);
    expect(created.messages).toEqual([]);
    expect(opened.messages[0]?.createdAt).toBe(ANSWER_JSON.created_at);
    expect(opened.messages[0]?.items[0]?.source).toBe("The Star");
    const calls = fetchMock.mock.calls as [URL, RequestInit][];
    expect(
      calls.map(([url, init]) => `${String(init.method)} ${url.href}`),
    ).toEqual([
      `GET ${BASE}api/chats`,
      `POST ${BASE}api/chats`,
      `GET ${BASE}api/chats/4`,
    ]);
  });

  it("reads the searches and the answer from the event stream", async () => {
    const search = { window: "the last 24 hours", count: 2 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        eventStream(
          event("searched", search) + event("message", ANSWER_JSON),
          9,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const seen: ChatSearch[] = [];

    const answer = await new HttpApiClient(BASE, () => undefined).askChat(
      4,
      "What happened in Malaysia?",
      (step) => seen.push(step),
    );

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/chats/4/messages`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ text: "What happened in Malaysia?" }),
    );
    expect(seen).toEqual([search]);
    expect(answer.role).toBe("assistant");
    expect(answer.text).toBe(ANSWER_JSON.text);
    expect(answer.items[0]?.id).toBe(7);
  });

  it("turns a failed answer into a RefusedError with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        eventStream(
          event("failed", {
            detail: "The Chat couldn't answer: the model timed out.",
          }),
          6,
        ),
      ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).askChat(
        4,
        "Hi",
        () => undefined,
      ),
    ).rejects.toEqual(
      new RefusedError("The Chat couldn't answer: the model timed out."),
    );
  });

  it("shows the spending limit's message when the Chat is refused", async () => {
    const detail = "This month's AI spending limit of $100.00 is reached.";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail }), { status: 429 }),
        ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).askChat(
        4,
        "Hi",
        () => undefined,
      ),
    ).rejects.toEqual(new RefusedError(detail));
  });
});
