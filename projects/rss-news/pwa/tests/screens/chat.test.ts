import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Chat, ChatMessage } from "../../src/api/chats";
import { ApiError, RefusedError } from "../../src/api/client";
import { storedPendingJobs } from "../../src/pwa/pending-jobs";
import { renderChatPanel } from "../../src/screens/chat";
import { FakeApiClient, LOST_JOB } from "../fake-api";

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
      importance: 4,
      publishedAt: "2026-10-12T08:00:00+00:00",
    },
    // As saved before answers kept the Importance and time.
    {
      id: 9,
      title: "Ringgit rises",
      source: "Reuters",
      summary: null,
      importance: null,
      publishedAt: null,
    },
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
    localStorage.clear();
  });

  it("remembers the question being answered, and forgets it once answered", async () => {
    api.chatAnswers = [{ jobId: "job-c", searches: [], result: ANSWER }];

    await render();
    askQuestion("What about Malaysia?");

    await screen.findByText(ANSWER.text);
    expect(api.questions).toEqual([[101, "What about Malaysia?"]]);
    expect(storedPendingJobs().answer(101)).toBeNull();
  });

  it("shows a question still being answered after coming back", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", []));
    storedPendingJobs().setAnswer(5, {
      jobId: "job-c",
      question: "What about Malaysia?",
    });
    api.answerJobs.set("job-c", { searches: [], result: "running" });

    await render(5);

    expect(screen.getByText("What about Malaysia?")).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Chat progress" }).textContent,
    ).toBe("Answering…");
    expect(api.followedJobs).toEqual(["job-c"]);
  });

  it("shows the answer that finished while the app was closed", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", []));
    storedPendingJobs().setAnswer(5, {
      jobId: "job-c",
      question: "What about Malaysia?",
    });
    api.answerJobs.set("job-c", { searches: [], result: ANSWER });

    await render(5);

    await screen.findByText(ANSWER.text);
    expect(screen.getByText("What about Malaysia?")).toBeTruthy();
    expect(storedPendingJobs().answer(5)).toBeNull();
  });

  it("doesn't follow a question again once its answer is saved", async () => {
    const question: ChatMessage = {
      ...ANSWER,
      id: 1,
      role: "owner",
      text: "What about Malaysia?",
      items: [],
    };
    api.savedChats.set(5, savedChat(5, "Malaysia", [question, ANSWER]));
    storedPendingJobs().setAnswer(5, {
      jobId: "job-forgotten",
      question: "What about Malaysia?",
    });

    await render(5);

    expect(api.followedJobs).toEqual([]);
    expect(storedPendingJobs().answer(5)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so when the server lost the question, and puts it back", async () => {
    api.savedChats.set(5, savedChat(5, "Malaysia", []));
    storedPendingJobs().setAnswer(5, {
      jobId: "job-gone",
      question: "What about Malaysia?",
    });

    await render(5);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(LOST_JOB);
    });
    expect(questionBox().value).toBe("What about Malaysia?");
    expect(storedPendingJobs().answer(5)).toBeNull();
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
    expect(screen.getByRole("link", { name: "Ringgit rises" })).toBeTruthy();
    expect(progress.textContent).toBe("");
    expect(api.chatsCreated).toBe(1);
    expect(api.questions).toEqual([[101, "What happened in Malaysia?"]]);
    expect(onChatOpened).toHaveBeenCalledWith(101);
  });

  it("shows each Item as a card: heading, summary, then Source, Importance and age", async () => {
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    await render();
    askQuestion("Malaysia?");
    await screen.findByText(ANSWER.text);

    const cards = screen
      .getAllByRole("listitem")
      .filter((card) => card.classList.contains("chat-item"));
    expect(cards).toHaveLength(2);
    const [first, second] = cards as [HTMLElement, HTMLElement];
    expect(
      within(first).getByRole("heading", { name: "Bank Negara holds rates" }),
    ).toBeTruthy();
    expect(within(first).getByText("Rates held at 2.75%.")).toBeTruthy();
    const meta = first.querySelector(".chat-item-meta");
    expect(meta?.textContent).toMatch(/^The Star · Importance 4 · .+$/);
    expect(meta?.querySelector("time")?.dateTime).toBe(
      "2026-10-12T08:00:00+00:00",
    );
    // An answer saved before the Importance and time were kept shows just the Source.
    expect(second.querySelector(".chat-item-meta")?.textContent).toBe(
      "Reuters",
    );
  });

  it("opens an Item from its heading, with the answer's Items as the list", async () => {
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    await render();
    askQuestion("Malaysia?");
    await screen.findByText(ANSWER.text);

    const link = screen.getByRole("link", { name: "Ringgit rises" });
    expect(link.getAttribute("href")).toBe("#items/9");
    link.click();

    expect(onOpenItem).toHaveBeenCalledWith(9, [7, 9]);
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

  describe("given a quote from Ask AI", () => {
    const QUOTE = {
      text: "kept the OPR at 2.75%",
      origin: "Item: BNM holds rates (The Star)",
    };

    async function renderWithQuote(): Promise<void> {
      await renderChatPanel(panel, api, {
        onOpenItem,
        onBriefThese,
        openChatId: null,
        onChatOpened,
        quote: QUOTE,
      });
    }

    it("opens with the quote and its origin above the question box", async () => {
      await renderWithQuote();

      expect(panel.dataset.sheet).toBe("open");
      const quoted = screen.getByRole("figure", { name: "Asking about" });
      expect(within(quoted).getByText(QUOTE.text)).toBeTruthy();
      expect(quoted.textContent).toContain(`From ${QUOTE.origin}`);
      expect(document.activeElement).toBe(questionBox());
    });

    it("sends the quote with the next question only", async () => {
      api.chatAnswers = [
        { searches: [], result: ANSWER },
        { searches: [], result: { ...ANSWER, id: 4 } },
      ];
      await renderWithQuote();

      askQuestion("What does this mean?");
      await screen.findByText(ANSWER.text);
      expect(screen.queryByRole("figure", { name: "Asking about" })).toBe(null);
      askQuestion("And for the ringgit?");
      await waitFor(() => {
        expect(api.quotes).toHaveLength(2);
      });

      expect(api.quotes).toEqual([QUOTE, null]);
    });

    it("lets the owner remove the quote before asking", async () => {
      api.chatAnswers = [{ searches: [], result: ANSWER }];
      await renderWithQuote();

      screen.getByRole("button", { name: "Remove the quote" }).click();
      askQuestion("What happened today?");
      await screen.findByText(ANSWER.text);

      expect(api.quotes).toEqual([null]);
    });
  });

  it("offers an answer's text for selection, naming it a Chat answer", async () => {
    api.chatAnswers = [{ searches: [], result: ANSWER }];
    await render();

    askQuestion("Malaysia?");
    const intro = await screen.findByText(ANSWER.text);

    expect(intro.closest("li")?.dataset.selectionOrigin).toBe("a Chat answer");
  });
});
