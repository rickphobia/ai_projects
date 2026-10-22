import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpApiClient, RefusedError } from "../../src/api/client";

const BASE = "https://example.test/ai-projects/rss-news/";

const SUMMARY_JSON = {
  gist: "The bank kept its rate.",
  points: ["It stayed at 2.75%."],
  from_preview: true,
  cost_usd: "0.0006",
};

const SUMMARY = {
  gist: "The bank kept its rate.",
  points: ["It stayed at 2.75%."],
  fromPreview: true,
  costUsd: "0.0006",
};

function eventStream(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function event(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("HttpApiClient Simple summaries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the summary from the event stream and hands over the job id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        eventStream(
          event("job", { id: "sum1" }) + event("summary", SUMMARY_JSON),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const started: string[] = [];

    const summary = await new HttpApiClient(
      BASE,
      () => undefined,
    ).simpleSummary(7, (jobId) => started.push(jobId));

    expect(summary).toEqual(SUMMARY);
    expect(started).toEqual(["sum1"]);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/items/7/simple-summary`);
    expect(init.method).toBe("POST");
  });

  it("turns a failed summary into a RefusedError with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          eventStream(
            event("job", { id: "sum1" }) +
              event("failed", { detail: "Nothing to summarise: no text." }),
          ),
        ),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).simpleSummary(7),
    ).rejects.toEqual(new RefusedError("Nothing to summarise: no text."));
  });

  it("follows a summary's job again by its id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        eventStream(
          event("job", { id: "sum1" }) + event("summary", SUMMARY_JSON),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const summary = await new HttpApiClient(
      BASE,
      () => undefined,
    ).followSimpleSummary("sum1");

    expect(summary).toEqual(SUMMARY);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/jobs/sum1`);
    expect(init.method).toBe("GET");
  });

  it("gives the saved summary, or null before the first", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ summary: SUMMARY_JSON })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: null })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpApiClient(BASE, () => undefined);

    expect(await client.savedSimpleSummary(7)).toEqual(SUMMARY);
    expect(await client.savedSimpleSummary(8)).toBeNull();
    const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}api/items/8/simple-summary`);
    expect(init.method).toBe("GET");
  });

  it("says when the stream ends before the summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(eventStream(event("job", { id: "sum1" }))),
    );

    await expect(
      new HttpApiClient(BASE, () => undefined).simpleSummary(7),
    ).rejects.toThrow("The summary stream ended before the summary arrived");
  });
});
