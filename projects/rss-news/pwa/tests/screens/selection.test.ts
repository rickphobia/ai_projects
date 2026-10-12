import { within } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatQuote } from "../../src/api/chats";
import { RefusedError } from "../../src/api/client";
import {
  installSelectionPopup,
  offerSelection,
  SETTLE_MS,
} from "../../src/screens/selection";
import { FakeApiClient } from "../fake-api";

// Selects `text` inside `element` as a finger or a mouse would, and lets the selection settle.
function select(element: Element, text: string): void {
  const node = element.firstChild;
  if (node === null) throw new Error("nothing to select");
  const start = (node.textContent ?? "").indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  settle();
}

function settle(): void {
  document.dispatchEvent(new Event("selectionchange"));
  vi.advanceTimersByTime(SETTLE_MS);
}

// Found by class, as the role queries skip it while it is hidden.
function popup(): HTMLElement {
  const found = document.querySelector<HTMLElement>(".selection-popup");
  if (found === null) throw new Error("no selection popup");
  return found;
}

describe("the selection popup", () => {
  let app: HTMLElement;
  let api: FakeApiClient;
  let asked: ChatQuote[];
  let paragraph: HTMLParagraphElement;
  let outside: HTMLParagraphElement;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no layout; the popup only needs a rectangle to sit under.
    Range.prototype.getBoundingClientRect = () => new DOMRect(40, 100, 80, 20);
    app = document.createElement("div");
    const article = document.createElement("article");
    offerSelection(article, "Item: BNM holds rates (The Star)", {
      kind: "item",
      id: 7,
    });
    paragraph = document.createElement("p");
    paragraph.textContent = "Bank Negara kept the OPR at 2.75% on Thursday.";
    article.append(paragraph);
    outside = document.createElement("p");
    outside.textContent = "The sidebar is not offered.";
    app.append(article, outside);
    document.body.replaceChildren(app);
    api = new FakeApiClient();
    asked = [];
    installSelectionPopup(app, api, (quote) => asked.push(quote));
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  it("shows Ask AI and Dictionary under a selection in an offered element", () => {
    expect(popup().hidden).toBe(true);

    select(paragraph, "OPR");

    expect(popup().hidden).toBe(false);
    expect(popup().style.top).toBe("128px");
    within(popup()).getByRole("button", { name: "Ask AI" });
    within(popup()).getByRole("button", { name: "Dictionary" });
  });

  it("stays hidden for text that isn't offered", () => {
    select(outside, "sidebar");

    expect(popup().hidden).toBe(true);
  });

  it("waits for the selection to settle, as Android's handles move it", () => {
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(SETTLE_MS - 1);

    expect(popup().hidden).toBe(true);
  });

  it("hides again when the selection is cleared", () => {
    select(paragraph, "OPR");
    window.getSelection()?.removeAllRanges();
    settle();

    expect(popup().hidden).toBe(true);
  });

  it("Ask AI hands over the selection and where it came from", () => {
    select(paragraph, "kept the OPR at 2.75%");

    within(popup()).getByRole("button", { name: "Ask AI" }).click();

    expect(asked).toEqual([
      {
        text: "kept the OPR at 2.75%",
        origin: "Item: BNM holds rates (The Star)",
      },
    ]);
    expect(popup().hidden).toBe(true);
  });

  it("keeps working when a tap on the popup clears the selection first", () => {
    select(paragraph, "OPR");
    const askAi = within(popup()).getByRole("button", { name: "Ask AI" });
    askAi.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    window.getSelection()?.removeAllRanges();
    settle();

    askAi.click();

    expect(asked).toEqual([
      { text: "OPR", origin: "Item: BNM holds rates (The Star)" },
    ]);
  });

  it("Dictionary defines the selection with its paragraph as context", async () => {
    select(paragraph, "OPR");

    within(popup()).getByRole("button", { name: "Dictionary" }).click();

    expect(api.lookUps).toEqual([
      ["OPR", "Bank Negara kept the OPR at 2.75% on Thursday."],
    ]);
    await vi.runAllTimersAsync();
    expect(
      within(popup()).getByRole("status", { name: "Definition" }).textContent,
    ).toBe("OPR: The rate Bank Negara Malaysia sets for overnight lending.");
  });

  it("Dictionary says why when it can't define the selection", async () => {
    api.definitionAnswer = new RefusedError(
      "This month's AI cost has reached the limit.",
    );
    select(paragraph, "OPR");

    within(popup()).getByRole("button", { name: "Dictionary" }).click();
    await vi.runAllTimersAsync();

    expect(
      within(popup()).getByRole("status", { name: "Definition" }).textContent,
    ).toBe("Couldn't look it up: This month's AI cost has reached the limit.");
  });

  it("Dictionary is off for a selection longer than a short phrase", () => {
    paragraph.textContent = "word ".repeat(30);
    select(paragraph, paragraph.textContent.trim());

    expect(
      within(popup()).getByRole<HTMLButtonElement>("button", {
        name: "Dictionary",
      }).disabled,
    ).toBe(true);
  });

  it("Note saves the selection with a comment and a link back", async () => {
    select(paragraph, "kept the OPR at 2.75%");

    within(popup()).getByRole("button", { name: "Note" }).click();
    within(popup()).getByRole<HTMLTextAreaElement>("textbox", {
      name: "Comment (optional)",
    }).value = "  check next month ";
    within(popup()).getByRole("button", { name: "Save Note" }).click();
    await vi.runAllTimersAsync();

    expect(api.notesSaved).toEqual([
      {
        text: "kept the OPR at 2.75%",
        comment: "check next month",
        source: {
          kind: "item",
          id: 7,
          title: "Item: BNM holds rates (The Star)",
        },
      },
    ]);
    expect(
      within(popup()).getByRole("status", { name: "Note" }).textContent,
    ).toBe("Saved to Notes.");
  });

  it("Note says why when the Note can't be saved", async () => {
    api.saveNoteError = new RefusedError("Select some text first.");
    select(paragraph, "OPR");

    within(popup()).getByRole("button", { name: "Note" }).click();
    within(popup()).getByRole("button", { name: "Save Note" }).click();
    await vi.runAllTimersAsync();

    expect(
      within(popup()).getByRole("status", { name: "Note" }).textContent,
    ).toBe("Couldn't save the Note: Select some text first.");
  });

  it("Note is off for text with nothing to link back to", () => {
    const answer = document.createElement("p");
    answer.textContent = "A Chat answer before the Chat is saved.";
    offerSelection(answer, "a Chat answer");
    app.append(answer);

    select(answer, "Chat answer");

    expect(
      within(popup()).getByRole<HTMLButtonElement>("button", { name: "Note" })
        .disabled,
    ).toBe(true);
  });
});
