import { afterEach, describe, expect, it, vi } from "vitest";

import type { BriefingProgress } from "../../src/api/briefings";
import { HttpApiClient, RefusedError } from "../../src/api/client";

const BASE = "https://example.test/ai-projects/rss-news/";

const BRIEFING_JSON = {
  id: 3,
  scope: "all-24h",
  created_at: "2026-10-12T12:00:00+00:00",
  item_count: 2,
  cost_usd: "0.21",
  sections: [
    {
      folder: { id: 1, name: "AI" },
      points: [
        { text: "A point.", items: [{ id: 5, title: "T", source: "S" }] },
      ],
    },
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

describe("HttpApiClient Briefings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the progress and the Briefing from the event stream", async () => {
    const progress = {
      step: "writing",
      section: 1,
      sections: 1,
      folder: "AI",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        eventStream(
          event("progress", progress) +
            event("briefing", { briefing: BRIEFING_JSON, reused: false }),
          7,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const seen: BriefingProgress[] = [];

    const written = await new HttpApiClient(
      BASE,
      () => undefined,
    ).writeBriefing(true, (step) => seen.push(step));

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/briefings`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ regenerate: true }));
    expect(seen).toEqual([progress]);
    expect(written.reused).toBe(false);
    expect(written.briefing.createdAt).toBe(BRIEFING_JSON.created_at);
    expect(written.briefing.costUsd).toBe("0.21");
    expect(written.briefing.sections[0]?.points[0]?.items[0]?.id).toBe(5);
  });

  it("turns a failed Briefing into a RefusedError with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream(event("failed", { detail: "It broke." }), 5),
        ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).writeBriefing(
        false,
        () => undefined,
      ),
    ).rejects.toEqual(new RefusedError("It broke."));
  });

  it("reads the estimate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            item_count: 40,
            section_count: 4,
            estimated_cost_usd: "0.31",
          }),
        ),
      ),
    );

    expect(
      await new HttpApiClient(BASE, () => undefined).briefingEstimate(),
    ).toEqual({ itemCount: 40, sectionCount: 4, estimatedCostUsd: "0.31" });
  });
});
