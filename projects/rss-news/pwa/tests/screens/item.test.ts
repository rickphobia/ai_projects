import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, RefusedError, type InboxItem } from "../../src/api/client";
import { renderItem } from "../../src/screens/item";
import { FakeApiClient } from "../fake-api";

const STORY: InboxItem = {
  id: 7,
  title: "Bank Negara holds rates",
  url: "https://news.example/7",
  source: "The Star",
  folder: { id: 1, name: "Malaysia" },
  publishedAt: "2026-10-12T04:00:00+00:00",
  importance: 4,
  summary: "Malaysia's central bank kept its policy rate at 2.75%.",
  read: false,
  imageUrl: null,
  stocks: [],
};

// Found by its label, not its role: it is hidden until Summarise is pressed.
function simpleSummary(): HTMLElement {
  const region = document.querySelector<HTMLElement>(
    '[aria-label="Simple summary"]',
  );
  if (region === null) throw new Error("no Simple summary region");
  return region;
}

function readerView(): HTMLElement {
  return screen.getByRole("region", { name: "Reader view" });
}

describe("the Item view", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.items = [{ ...STORY }];
  });

  it("shows the owner's stocks the Item mentions", async () => {
    api.items = [{ ...STORY, stocks: ["1155.KL"] }];
    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(screen.getByLabelText("Mentions 1155.KL").textContent).toBe(
      "1155.KL",
    );
  });

  it("shows the summary, Source, time and Importance at once, with the original link", async () => {
    api.holdReaderView = true;
    const shown = renderItem(root, api, 7, { onBack: () => undefined });

    await waitFor(() => {
      expect(readerView().getAttribute("aria-busy")).toBe("true");
    });
    expect(
      screen.getByRole("heading", { name: "Bank Negara holds rates" }),
    ).toBeTruthy();
    expect(screen.getByText(STORY.summary ?? "")).toBeTruthy();
    expect(screen.getByText(/The Star · .* · Importance 4/)).toBeTruthy();
    expect(readerView().textContent).toBe("Loading the article…");
    const original = screen.getByRole("link", {
      name: "Open the original page",
    });
    expect(original.getAttribute("href")).toBe(STORY.url);
    expect(original.getAttribute("target")).toBe("_blank");
    expect(original.getAttribute("rel")).toBe("noopener noreferrer");

    api.releaseReaderView?.();
    await shown;
  });

  it("leaves the Item unread when it opens", async () => {
    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(api.itemsOpened).toEqual([7]);
    expect(api.readMarks).toEqual([]);
  });

  it("offers no Read button on an unread Item", async () => {
    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(screen.queryByRole("button", { name: "✓ Read" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark unread" })).toBeNull();
  });

  it("shows a read Item's button as Mark unread", async () => {
    api.items = [{ ...STORY, read: true }];
    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(screen.getByRole("button", { name: "Mark unread" })).toBeTruthy();
  });

  it("marks a read Item unread, and read again", async () => {
    api.items = [{ ...STORY, read: true }];
    await renderItem(root, api, 7, { onBack: () => undefined });

    screen.getByRole("button", { name: "Mark unread" }).click();

    const again = await screen.findByRole("button", { name: "✓ Read" });
    again.click();
    await screen.findByRole("button", { name: "Mark unread" });
    expect(api.readMarks).toEqual([
      [7, false],
      [7, true],
    ]);
  });

  it("loads Reader view without a button press, one paragraph per line", async () => {
    api.readerViews.set(7, {
      title: STORY.title,
      text: "The bank held rates.\n\nThe ringgit firmed.",
      problem: null,
    });

    await renderItem(root, api, 7, { onBack: () => undefined });

    const paragraphs = Array.from(readerView().querySelectorAll("p")).map(
      (paragraph) => paragraph.textContent,
    );
    expect(paragraphs).toEqual(["The bank held rates.", "The ringgit firmed."]);
    expect(readerView().hasAttribute("aria-busy")).toBe(false);
  });

  it("says why Reader view failed and offers the original page", async () => {
    api.readerViews.set(
      7,
      new ApiError("Reader view isn't available: the page answered HTTP 403."),
    );

    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(screen.getByRole("alert").textContent).toBe(
      "Reader view isn't available: the page answered HTTP 403.",
    );
    const links = screen.getAllByRole("link", {
      name: "Open the original page",
    });
    expect(links).toHaveLength(2);
    expect(readerView().contains(links[1] ?? null)).toBe(true);
  });

  it("shows the feed's preview when the page can't be read, saying why", async () => {
    api.readerViews.set(7, {
      title: null,
      text: "What the feed says.",
      problem: "the page answered HTTP 403",
    });

    await renderItem(root, api, 7, { onBack: () => undefined });

    const paragraphs = Array.from(readerView().querySelectorAll("p")).map(
      (paragraph) => paragraph.textContent,
    );
    expect(paragraphs).toEqual([
      "Couldn't load the full article (the page answered HTTP 403). This is the preview from the feed.",
      "What the feed says.",
    ]);
    const links = screen.getAllByRole("link", {
      name: "Open the original page",
    });
    expect(readerView().contains(links[1] ?? null)).toBe(true);
  });

  it("says so when the page can't be read and the feed gave no preview", async () => {
    api.readerViews.set(7, {
      title: null,
      text: "",
      problem: "the page answered HTTP 403",
    });

    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(readerView().querySelector("p")?.textContent).toBe(
      "No article to show (the page answered HTTP 403). Open the original page to see it.",
    );
  });

  it("asks for no Simple summary until Summarise is pressed", async () => {
    await renderItem(root, api, 7, { onBack: () => undefined });

    expect(api.simpleSummariesAsked).toEqual([]);
    expect(simpleSummary().hidden).toBe(true);
  });

  it("shows the Simple summary's gist and points when Summarise is pressed", async () => {
    await renderItem(root, api, 7, { onBack: () => undefined });

    screen.getByRole("button", { name: "Summarise" }).click();

    await waitFor(() => {
      expect(simpleSummary().querySelectorAll("li")).toHaveLength(2);
    });
    expect(api.simpleSummariesAsked).toEqual([7]);
    expect(simpleSummary().hidden).toBe(false);
    expect(simpleSummary().querySelector("p")?.textContent).toBe(
      "Malaysia's central bank kept its main interest rate the same.",
    );
    expect(
      [...simpleSummary().querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual(["It left the rate at 2.75%.", "Loan rates should stay steady."]);
    // Pressing again would pay for the same summary twice.
    expect(screen.queryByRole("button", { name: "Summarise" })).toBeNull();
  });

  it("says when the Simple summary only covers the feed's preview", async () => {
    api.simpleSummaryAnswer = {
      gist: "A short gist.",
      points: ["One point."],
      fromPreview: true,
      costUsd: "0.0001",
    };
    await renderItem(root, api, 7, { onBack: () => undefined });

    screen.getByRole("button", { name: "Summarise" }).click();

    await waitFor(() => {
      expect(simpleSummary().textContent).toContain(
        "this only covers the feed's preview",
      );
    });
  });

  it("says why a Simple summary failed and lets the owner try again", async () => {
    api.simpleSummaryAnswer = new RefusedError(
      "This month's AI cost has reached the limit",
    );
    await renderItem(root, api, 7, { onBack: () => undefined });
    const button = screen.getByRole("button", { name: "Summarise" });

    button.click();

    await waitFor(() => {
      expect(simpleSummary().querySelector('[role="alert"]')?.textContent).toBe(
        "Couldn't summarise it: This month's AI cost has reached the limit",
      );
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("says so when the Item can't be opened", async () => {
    await renderItem(root, api, 99, { onBack: () => undefined });

    expect(screen.getByRole("status", { name: "Item" }).textContent).toBe(
      "Couldn't open the Item: no Item 99",
    );
  });

  it("goes back to the Inbox", async () => {
    const onBack = vi.fn();
    await renderItem(root, api, 7, { onBack });

    screen.getByRole("button", { name: "Back to Inbox" }).click();

    expect(onBack).toHaveBeenCalled();
  });
});
