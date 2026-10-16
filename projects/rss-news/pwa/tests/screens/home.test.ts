import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../../src/api/chats";
import { renderHome } from "../../src/screens/home";
import { FakeApiClient } from "../fake-api";

const ANSWER: ChatMessage = {
  id: 2,
  role: "assistant",
  createdAt: "2026-10-12T09:05:00+00:00",
  text: "In the last 24 hours, 1 Item stood out.",
  items: [
    {
      id: 7,
      title: "Bank Negara holds rates",
      source: "The Star",
      summary: "Rates held at 2.75%. Loans cost the same for now.",
      importance: 4,
      publishedAt: "2026-10-12T08:00:00+00:00",
    },
  ],
};

function questionBox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Ask about your news" });
}

function suggestions(): HTMLElement {
  return screen.getByRole("group", { name: "Suggested questions" });
}

describe("the home screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;
  let onOpenItem: (itemId: number, listedIds?: number[]) => void;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    onOpenItem = vi.fn();
  });

  const render = (
    options: { open?: boolean; now?: Date } = {},
  ): Promise<void> =>
    renderHome(
      root,
      api,
      {
        onOpenItem,
        onBriefThese: vi.fn(),
        openChatId: null,
        open: options.open ?? false,
      },
      options.now,
    );

  it("greets the owner by the time of day, over the question box", async () => {
    await render({ now: new Date(2026, 9, 16, 15, 0) });

    expect(
      screen.getByRole("heading", { name: "Good afternoon" }),
    ).toBeTruthy();
    expect(questionBox().placeholder).toBe("Ask anything about your news…");
    // Brief me lives in the Inbox now.
    expect(screen.queryByRole("button", { name: /Brief me/ })).toBeNull();
  });

  it("says good morning and good evening too", async () => {
    await render({ now: new Date(2026, 9, 16, 8, 0) });
    expect(screen.getByRole("heading", { name: "Good morning" })).toBeTruthy();

    await render({ now: new Date(2026, 9, 16, 21, 0) });
    expect(screen.getByRole("heading", { name: "Good evening" })).toBeTruthy();
  });

  it("asks a suggested question as soon as it is chosen", async () => {
    await render();

    within(suggestions())
      .getByRole("button", { name: "What's interesting today?" })
      .click();

    await screen.findByText(ANSWER.text);
    expect(api.questions).toEqual([[101, "What's interesting today?"]]);
    // Once the Chat has started, the suggestions make way for it.
    expect(
      screen.queryByRole("group", { name: "Suggested questions" }),
    ).toBeNull();
  });

  it("offers a summary of the last 24 hours", async () => {
    await render();

    within(suggestions())
      .getByRole("button", { name: "Summarise the last 24 hours" })
      .click();

    await screen.findByText(ANSWER.text);
    expect(api.questions).toEqual([[101, "Summarise the last 24 hours"]]);
  });

  it("leaves the topic suggestion in the box for the owner to finish", async () => {
    await render();

    within(suggestions())
      .getByRole("button", { name: "Summarise the last 24 hours on…" })
      .click();

    expect(questionBox().value).toBe("Summarise the last 24 hours on ");
    expect(document.activeElement).toBe(questionBox());
    expect(api.questions).toEqual([]);
  });

  it("asks with Enter, and Shift+Enter doesn't", async () => {
    await render();
    questionBox().value = "Anything on chips?";

    questionBox().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(api.questions).toEqual([]);

    questionBox().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await screen.findByText(ANSWER.text);
    expect(api.questions).toEqual([[101, "Anything on chips?"]]);
  });

  it("shows an answer's Items as linked headings with their summaries", async () => {
    await render();
    questionBox().value = "Malaysia?";
    screen.getByRole("button", { name: "Ask" }).click();

    const link = await screen.findByRole("link", {
      name: "Bank Negara holds rates",
    });
    expect(
      screen.getByText("Rates held at 2.75%. Loans cost the same for now."),
    ).toBeTruthy();
    link.click();
    expect(onOpenItem).toHaveBeenCalledWith(7, [7]);
  });

  it("puts the cursor in the box for the Chat shortcut", async () => {
    await render({ open: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(questionBox());
    });
  });

  it("keeps the Chat history under the box", async () => {
    await render();

    expect(screen.getByText("Chat history")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Chat" })).toBeTruthy();
  });
});
