import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Chat, ChatMessage } from "../../src/api/chats";
import { ApiError, RefusedError } from "../../src/api/client";
import { renderChatPanel } from "../../src/screens/chat";
import { FakeApiClient } from "../fake-api";

const ANSWER: ChatMessage = {
  id: 2,
  role: "assistant",
  createdAt: "2026-10-12T09:05:00+00:00",
  text: "In the last 24 hours, 2 Items mention Malaysia.",
  items: [
    {
      id: 7,
      title: "Bank Negara holds rates",
      source: "The Star",
      summary: "Rates held at 2.75%.",
    },
    { id: 9, title: "Ringgit rises", source: "Reuters", summary: null },
  ],
};

function savedChat(id: number, title: string, messages: ChatMessage[]): Chat {
  return {
    id,
    title,
    createdAt: "2026-10-10T09:00:00+00:00",
    updatedAt: "2026-10-10T09:00:00+00:00",
    costUsd: "0.05",
    messages,
  };
}

function questionBox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Ask about your news" });
}

function askQuestion(text: string): void {
  questionBox().value = text;
  screen.getByRole("button", { name: "Ask" }).click();
}

describe("the Chat panel", () => {
  let panel: HTMLElement;
  let api: FakeApiClient;
  let onOpenItem: (itemId: number) => void;
  let onBriefThese: (itemIds: number[]) => void;
  let onChatOpened: (chatId: number) => void;

  beforeEach(() => {
    panel = document.createElement("aside");
    document.body.replaceChildren(panel);
    api = new FakeApiClient();
    onOpenItem = vi.fn();
    onBriefThese = vi.fn();
    onChatOpened = vi.fn();
  });

  async function render(openChatId: number | null = null): Promise<void> {
    await renderChatPanel(panel, api, {
      onOpenItem,
      onBriefThese,
      openChatId,
      onChatOpened,
    });
  }

  it("shows each search, then the intro and the Items with their summaries", async () => {
    let releaseAnswer: (() => void) | null = null;
    api.chatAnswers = [
      {
        searches: [{ window: "the last 24 hours", count: 2 }],
        result: ANSWER,
      },
    ];
    const askChat = api.askChat.bind(api);
    api.askChat = async (chatId, question, onSearched) => {
      const answer = await askChat(chatId, question, onSearched);
      await new Promise<void>((resolve) => {
        releaseAnswer = resolve;
      });
      return answer;
    };
    await render();

    askQuestion("What happened in Malaysia?");

    const progress = screen.getByRole("status", { name: "Chat progress" });
    await waitFor(() => {
      expect(progress.textContent).toBe("Searched the last 24 hours: 2 Items.");
    });
    expect(screen.getByText("What happened in Malaysia?")).toBeTruthy();
    expect(questionBox().value).toBe("");
    (releaseAnswer as unknown as () => void)();
    await screen.findByText(ANSWER.text);
    expect(
      screen.getByText("Rates held at 2.75%.", { exact: false }),
    ).toBeTruthy();
    // An unscored Item shows its title instead of a summary.
    expect(screen.getByText("Ringgit rises", { exact: false })).toBeTruthy();
    expect(progress.textContent).toBe("");
    expect(api.chatsCreated).toBe(1);
    expect(api.questions).toEqual([[101, "What happened in Malaysia?"]]);
    expect(onChatOpened).toHaveBeenCalledWith(101);
  });

  it("opens an Item from its Source button", async () => {
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    await render();
    askQuestion("Malaysia?");
    await screen.findByText(ANSWER.text);

    screen.getByRole("button", { name: "Reuters: Ringgit rises" }).click();

    expect(onOpenItem).toHaveBeenCalledWith(9);
  });

  it("offers a Briefing of exactly the answer's Items", async () => {
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    await render();
    askQuestion("Malaysia?");
    await screen.findByText(ANSWER.text);

    screen.getByRole("button", { name: "Brief these (2)" }).click();

    expect(onBriefThese).toHaveBeenCalledWith([7, 9]);
  });

  it("shows why an answer failed and puts the question back to try again", async () => {
    api.chatAnswers = [
      {
        searches: [],
        result: new RefusedError(
          "The Chat couldn't answer: the model timed out.",
        ),
      },
    ];
    await render();

    askQuestion("What happened in Malaysia?");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "The Chat couldn't answer: the model timed out.",
      );
    });
    expect(questionBox().value).toBe("What happened in Malaysia?");
    expect(
      within(screen.getByRole("list", { name: "Messages" })).queryAllByRole(
        "listitem",
      ),
    ).toEqual([]);
    expect(screen.getByRole("button", { name: "Ask" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("says what failed when the answer breaks without a reason", async () => {
    api.chatAnswers = [
      {
        searches: [],
        result: new ApiError("POST /api/chats/101/messages answered 500"),
      },
    ];
    await render();

    askQuestion("Malaysia?");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "The Chat couldn't answer: POST /api/chats/101/messages answered 500",
      );
    });
  });

  it("lists the earlier Chats newest used first, and continues the one chosen", async () => {
    const older = savedChat(3, "Fed rate path", []);
    const newer = savedChat(5, "What happened in Malaysia", [
      {
        id: 1,
        role: "owner",
        createdAt: "2026-10-10T09:00:00+00:00",
        text: "What happened in Malaysia?",
        items: [],
      },
      ANSWER,
    ]);
    api.chatsAnswer = [newer, older];
    api.savedChats.set(3, older);
    api.savedChats.set(5, newer);
    api.chatAnswers = [
      {
        searches: [],
        result: { ...ANSWER, id: 4, text: "Since Monday, 2 Items.", items: [] },
      },
    ];
    await render();

    const earlier = screen.getByRole("list", { name: "Earlier Chats" });
    expect(
      within(earlier)
        .getAllByRole("button")
        .map((choice) => choice.textContent),
    ).toEqual(["What happened in Malaysia", "Fed rate path"]);

    within(earlier)
      .getByRole("button", { name: "What happened in Malaysia" })
      .click();
    await screen.findByText(ANSWER.text);
    expect(screen.getByText("What happened in Malaysia?")).toBeTruthy();
    expect(onChatOpened).toHaveBeenCalledWith(5);

    askQuestion("And since Monday?");
    await screen.findByText("Since Monday, 2 Items.");
    expect(api.questions).toEqual([[5, "And since Monday?"]]);
    expect(api.chatsCreated).toBe(0);
  });

  it("reopens the Chat it was showing, with the sheet open", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", [ANSWER]));

    await render(5);

    expect(screen.getByText(ANSWER.text)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Chat" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("keeps Ask off while a Chat loads, so a question can't start a new Chat", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", [ANSWER]));

    const rendering = render(5);
    const askButton = screen.getByRole("button", { name: "Ask" });
    expect(askButton).toHaveProperty("disabled", true);
    await rendering;

    expect(askButton).toHaveProperty("disabled", false);
  });

  it("opens the sheet onto the question box and closes it with Escape", async () => {
    await render();
    const toggle = screen.getByRole("button", { name: "Chat" });

    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(questionBox());
    questionBox().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("starts a new Chat on the next question after New Chat", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", [ANSWER]));
    api.chatAnswers = [{ searches: [], result: { ...ANSWER, id: 8 } }];
    await render(5);

    screen.getByRole("button", { name: "New Chat" }).click();
    expect(screen.queryByText(ANSWER.text)).toBeNull();
    askQuestion("Anything on chips?");
    await screen.findByText(ANSWER.text);

    expect(api.questions).toEqual([[101, "Anything on chips?"]]);
  });
});
