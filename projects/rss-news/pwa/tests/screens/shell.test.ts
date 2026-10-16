import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type InboxItem } from "../../src/api/client";
import { renderShell } from "../../src/screens/shell";
import { FakeApiClient } from "../fake-api";

describe("the app shell", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  let scrolledTo: number[];

  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    // Each test starts at the app's address with no screen in it.
    history.replaceState(null, "", "/");
    scrolledTo = [];
    window.scrollTo = ((_x: number, y: number) => {
      scrolledTo.push(y);
    }) as typeof window.scrollTo;
  });

  function currentScreen(): string[] {
    return [...root.querySelectorAll("[aria-current=page]")].map(
      (entry) => entry.textContent,
    );
  }

  it("names the app and says the server is up", async () => {
    await renderShell(root, api, () => undefined);

    expect(screen.getByRole("heading", { name: "rss-news" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Server" }).textContent).toBe(
      "The server is up.",
    );
  });

  it("opens on the Item a tapped Alert names, with a way back Home", async () => {
    api.items = [
      {
        id: 7,
        title: "Bank Negara holds rates",
        url: "https://news.example/7",
        source: "The Star",
        folder: { id: 1, name: "Malaysia" },
        publishedAt: "2026-10-12T04:00:00+00:00",
        importance: 5,
        summary: "Malaysia's central bank kept its policy rate at 2.75%.",
        read: false,
        imageUrl: null,
        stocks: [],
      },
    ];

    await renderShell(root, api, () => undefined, { openItemId: 7 });

    expect(
      screen.getByRole("heading", { name: "Bank Negara holds rates" }),
    ).toBeTruthy();
    expect(api.itemsOpened).toEqual([7]);
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeTruthy();
  });

  it("the Brief me (24h) shortcut briefs the last 24 hours at once", async () => {
    api.writeAnswers = [
      { progress: [], result: new Error("The AI provider is down.") },
    ];

    await renderShell(root, api, () => undefined, { shortcut: "brief" });

    await waitFor(() => {
      expect(api.writeScopes).toEqual([{ window: "24h" }]);
    });
    // Brief me lives in the Inbox.
    expect(
      screen
        .getByRole("button", { name: "Inbox" })
        .getAttribute("aria-current"),
    ).toBe("page");
    // Not a regenerate: today's saved Briefing is shown if there is one.
    expect(api.writeRequests).toEqual([false]);
  });

  it("the Chat shortcut opens Home with the cursor in the question box", async () => {
    await renderShell(root, api, () => undefined, { shortcut: "chat" });

    expect(
      screen.getByRole("button", { name: "Home" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Ask about your news" }),
    );
  });

  it("the Notes shortcut opens the Notes", async () => {
    await renderShell(root, api, () => undefined, { shortcut: "notes" });

    expect(
      screen
        .getByRole("button", { name: "Notes" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  const STORY: InboxItem = {
    id: 7,
    title: "Bank Negara holds rates",
    url: "https://news.example/7",
    source: "The Star",
    folder: { id: 1, name: "Malaysia" },
    publishedAt: "2026-10-12T04:00:00+00:00",
    importance: 5,
    summary: "Malaysia's central bank kept its policy rate at 2.75%.",
    read: false,
    imageUrl: null,
    stocks: [],
  };

  // Selects the Item's summary and presses the selection popup's Ask AI.
  async function askAiAboutTheSummary(): Promise<void> {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    const range = document.createRange();
    const summary = root.querySelector(".item-summary");
    if (summary === null) throw new Error("no Item summary");
    range.selectNodeContents(summary);
    // jsdom keeps one range; an earlier test's focus can leave one behind.
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    (await screen.findByRole("button", { name: "Ask AI" })).click();
  }

  function askAiPanel(): HTMLElement {
    const panel = root.querySelector<HTMLElement>(".ask-ai");
    if (panel === null) throw new Error("no Ask AI panel");
    return panel;
  }

  it("Ask AI on an Item's text opens the Chat beside the Item with the quote", async () => {
    api.items = [{ ...STORY }];
    await renderShell(root, api, () => undefined, { openItemId: 7 });

    await askAiAboutTheSummary();

    const quoted = await screen.findByRole("figure", { name: "Asking about" });
    expect(quoted.textContent).toContain(
      "From Item: Bank Negara holds rates (The Star)",
    );
    expect(askAiPanel().contains(quoted)).toBe(true);
    expect(askAiPanel().hidden).toBe(false);
    // Still on the Item, not sent Home.
    expect(location.hash).toBe("#items/7");
    expect(
      screen.getByRole("heading", { name: "Bank Negara holds rates" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Home" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("closes the Item's Ask AI panel with Close, and ends it on leaving the Item", async () => {
    api.items = [{ ...STORY }];
    await renderShell(root, api, () => undefined, { openItemId: 7 });
    await askAiAboutTheSummary();
    await screen.findByRole("figure", { name: "Asking about" });

    within(askAiPanel()).getByRole("button", { name: "Close" }).click();
    expect(askAiPanel().hidden).toBe(true);

    await askAiAboutTheSummary();
    await waitFor(() => {
      expect(askAiPanel().hidden).toBe(false);
    });
    screen.getByRole("button", { name: "Home" }).click();

    await waitFor(() => {
      expect(askAiPanel().hidden).toBe(true);
    });
    expect(askAiPanel().childElementCount).toBe(0);
  });

  it("says when the database is unreachable", async () => {
    api.healthAnswer = { status: "failing", database: "unreachable" };

    await renderShell(root, api, () => undefined);

    expect(
      screen.getByRole("status", { name: "Server" }).textContent,
    ).toContain("database is unreachable");
  });

  it("says when the server can't be reached", async () => {
    api.healthAnswer = new ApiError("GET /healthz answered 502");

    await renderShell(root, api, () => undefined);

    expect(screen.getByRole("status", { name: "Server" }).textContent).toBe(
      "Can't reach the server: GET /healthz answered 502",
    );
  });

  it("starts on the home screen's Chat; the latest Briefing is in the Inbox", async () => {
    api.latestBriefingAnswer = {
      id: 1,
      scope: "all-24h",
      title: "All Sources, last 24 hours",
      createdAt: "2026-10-12T00:30:00+00:00",
      itemCount: 1,
      costUsd: "0.20",
      sections: [
        {
          folder: { id: 1, name: "AI" },
          points: [
            {
              text: "A model came out.",
              items: [{ id: 1, title: "A story", source: "Example" }],
            },
          ],
        },
      ],
    };
    api.items = [
      {
        id: 1,
        title: "A story",
        url: "https://news.example/1",
        source: "Example",
        folder: { id: 1, name: "AI" },
        publishedAt: "2026-10-12T04:00:00+00:00",
        importance: 4,
        summary: "Something happened.",
        read: false,
        imageUrl: null,
        stocks: [],
      },
    ];

    await renderShell(root, api, () => undefined);

    expect(
      screen.getByRole("textbox", { name: "Ask about your news" }),
    ).toBeTruthy();
    expect(screen.queryByText("A model came out.")).toBeNull();

    screen.getByRole("button", { name: "Inbox" }).click();
    const card = (await screen.findByText("Brief me")).closest("details");
    if (card) card.open = true;
    card?.dispatchEvent(new Event("toggle"));
    await screen.findByText("A model came out.");
    screen.getByRole("link", { name: "Example: A story" }).click();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "A story" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Back to Inbox" })).toBeTruthy();
  });

  it("shows the Inbox", async () => {
    api.items = [
      {
        id: 1,
        title: "A story",
        url: "https://news.example/1",
        source: "Example",
        folder: { id: 1, name: "AI" },
        publishedAt: "2026-10-12T04:00:00+00:00",
        importance: null,
        summary: null,
        read: false,
        imageUrl: null,
        stocks: [],
      },
    ];

    await renderShell(root, api, () => undefined);
    screen.getByRole("button", { name: "Inbox" }).click();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "A story" })).toBeTruthy();
    });
  });

  it("opens an Item from the Inbox and goes back", async () => {
    api.items = [
      {
        id: 1,
        title: "A story",
        url: "https://news.example/1",
        source: "Example",
        folder: { id: 1, name: "AI" },
        publishedAt: "2026-10-12T04:00:00+00:00",
        importance: 4,
        summary: "Something happened.",
        read: false,
        imageUrl: null,
        stocks: [],
      },
    ];
    await renderShell(root, api, () => undefined);
    screen.getByRole("button", { name: "Inbox" }).click();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "A story" })).toBeTruthy();
    });

    screen.getByRole("link", { name: "A story" }).click();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "A story" })).toBeTruthy();
    });
    screen.getByRole("button", { name: "Back to Inbox" }).click();
    // Back goes through the browser's history, so the Inbox comes back a moment later.
    expect(await screen.findByRole("link", { name: "A story" })).toBeTruthy();
    // Opening it isn't reading it: only the Read button takes it out of the Unread list.
    expect(screen.getByLabelText("Unread")).toBeTruthy();
  });

  it("finishes an Item into the next one, and Back still returns to the Inbox", async () => {
    const story = (id: number, title: string): InboxItem => ({
      id,
      title,
      url: `https://news.example/${String(id)}`,
      source: "Example",
      folder: { id: 1, name: "AI" },
      publishedAt: "2026-10-12T04:00:00+00:00",
      importance: 4,
      summary: "Something happened.",
      read: false,
      imageUrl: null,
      stocks: [],
    });
    api.items = [story(2, "First story"), story(1, "Second story")];
    await renderShell(root, api, () => undefined);
    screen.getByRole("button", { name: "Inbox" }).click();
    (await screen.findByRole("link", { name: "First story" })).click();
    await screen.findByRole("heading", { name: "First story" });

    screen.getByRole("button", { name: "Mark read: next Item ↓" }).click();

    await screen.findByRole("heading", { name: "Second story" });
    expect(location.hash).toBe("#items/1");
    expect(api.readMarks).toEqual([[2, true]]);
    // The last Item goes back instead.
    expect(
      screen.getByRole("button", { name: "Mark read and go back" }),
    ).toBeTruthy();

    screen.getByRole("button", { name: "Back to Inbox" }).click();

    expect(
      await screen.findByRole("link", { name: "Second story" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "First story" })).toBeNull();
  });

  describe("the Chat on Home", () => {
    beforeEach(() => {
      api.items = [
        {
          id: 7,
          title: "Bank Negara holds rates",
          url: "https://news.example/7",
          source: "The Star",
          folder: { id: 1, name: "Malaysia" },
          publishedAt: "2026-10-12T04:00:00+00:00",
          importance: 5,
          summary: "Malaysia's central bank kept its policy rate at 2.75%.",
          read: false,
          imageUrl: null,
          stocks: [],
        },
      ];
      api.chatAnswers = [
        {
          searches: [],
          result: {
            id: 2,
            role: "assistant",
            createdAt: "2026-10-12T09:05:00+00:00",
            text: "In the last 24 hours, 1 Item mentions Malaysia.",
            items: [
              {
                id: 7,
                title: "Bank Negara holds rates",
                source: "The Star",
                summary: "Rates held at 2.75%.",
                importance: 5,
                publishedAt: "2026-10-12T04:00:00+00:00",
              },
            ],
          },
        },
      ];
    });

    async function askOnHome(): Promise<void> {
      await renderShell(root, api, () => undefined);
      const box = await screen.findByRole("textbox", {
        name: "Ask about your news",
      });
      (box as HTMLTextAreaElement).value = "What happened in Malaysia?";
      screen.getByRole("button", { name: "Ask" }).click();
      await screen.findByText("Rates held at 2.75%.", { exact: false });
    }

    it("opens an answer's Item from its heading and comes back to the Chat", async () => {
      await askOnHome();

      screen.getByRole("link", { name: "Bank Negara holds rates" }).click();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Bank Negara holds rates" }),
        ).toBeTruthy();
      });
      expect(api.itemsOpened).toEqual([7]);

      screen.getByRole("button", { name: "Back to Home" }).click();
      await waitFor(() => {
        expect(screen.getByText("What happened in Malaysia?")).toBeTruthy();
      });
    });

    it("offers a Briefing of exactly an answer's Items from Brief these", async () => {
      await askOnHome();

      screen.getByRole("button", { name: "Brief these (1)" }).click();

      await waitFor(() => {
        expect(api.estimateRequests).toContainEqual({ itemIds: [7] });
      });
      expect(
        screen
          .getByRole("button", { name: "Inbox" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(screen.getByText("Brief me").closest("details")?.open).toBe(true);
    });
  });

  it("opens the sidebar drawer from Menu and closes it again", async () => {
    await renderShell(root, api, () => undefined);
    const menu = screen.getByRole("button", { name: "Menu" });
    const page = screen.getByRole("main");
    const isOpen = (): boolean => menu.getAttribute("aria-expanded") === "true";
    expect(isOpen()).toBe(false);
    expect(page.inert).toBe(false);

    menu.click();
    expect(isOpen()).toBe(true);
    // The keyboard goes into the drawer and can't reach the page behind it.
    expect(document.activeElement?.textContent).toBe("Home");
    expect(page.inert).toBe(true);
    screen.getByRole("button", { name: "Close menu" }).click();
    expect(isOpen()).toBe(false);
    expect(page.inert).toBe(false);
    expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();

    menu.click();
    screen
      .getByRole("button", { name: "Inbox" })
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(menu);

    menu.click();
    screen.getByRole("button", { name: "Briefings" }).click();
    expect(isOpen()).toBe(false);
  });

  it("marks the screen being shown in the sidebar", async () => {
    await renderShell(root, api, () => undefined);
    const current = (): string[] =>
      [...root.querySelectorAll("[aria-current=page]")].map(
        (entry) => entry.textContent,
      );
    expect(current()).toEqual(["Home"]);

    screen.getByRole("button", { name: "Settings" }).click();

    expect(current()).toEqual(["Settings"]);
  });

  it("opens the Stocks screen from the sidebar", async () => {
    await renderShell(root, api, () => undefined);

    screen.getByRole("button", { name: "Stocks" }).click();

    expect(
      await screen.findByRole("form", { name: "Add to the Watchlist" }),
    ).toBeTruthy();
  });

  it("opens the Inbox of a Folder chosen in the sidebar", async () => {
    api.foldersAnswer = [
      { id: 1, name: "AI" },
      { id: 2, name: "World" },
    ];
    await renderShell(root, api, () => undefined);
    const folders = screen.getByRole("list", { name: "Folders" });

    within(folders).getByRole("button", { name: "World" }).click();

    await waitFor(() => {
      expect(api.inboxQueries.at(-1)).toEqual({ read: "unread", folderId: 2 });
    });
    expect(
      within(folders)
        .getByRole("button", { name: "World" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("signs out and goes back to login", async () => {
    const onSignedOut = vi.fn();
    await renderShell(root, api, onSignedOut);

    screen.getByRole("button", { name: "Sign out" }).click();

    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledOnce();
    });
    expect(api.logouts).toBe(1);
  });

  describe("history", () => {
    const STORY = {
      id: 1,
      title: "A story",
      url: "https://news.example/1",
      source: "Example",
      folder: { id: 1, name: "AI" },
      publishedAt: "2026-10-12T04:00:00+00:00",
      importance: 4,
      summary: "Something happened.",
      read: false,
      imageUrl: null,
      stocks: [],
    };

    it("gives each screen an address, and Back and Forward move between them", async () => {
      await renderShell(root, api, () => undefined);
      expect(location.hash).toBe("#home");

      screen.getByRole("button", { name: "Inbox" }).click();
      expect(location.hash).toBe("#inbox");
      screen.getByRole("button", { name: "Settings" }).click();
      expect(location.hash).toBe("#settings");

      history.back();
      await waitFor(() => {
        expect(currentScreen()).toEqual(["Inbox"]);
      });
      expect(location.hash).toBe("#inbox");

      history.forward();
      await waitFor(() => {
        expect(currentScreen()).toEqual(["Settings"]);
      });
    });

    it("opens the screen in the address, as after a reload", async () => {
      history.replaceState(null, "", "/#settings");

      await renderShell(root, api, () => undefined);

      expect(currentScreen()).toEqual(["Settings"]);
    });

    it("goes back from an Item to the Inbox where it was scrolled to", async () => {
      api.items = [STORY];
      await renderShell(root, api, () => undefined);
      screen.getByRole("button", { name: "Inbox" }).click();
      const link = await screen.findByRole("link", { name: "A story" });
      Object.defineProperty(window, "scrollY", {
        value: 640,
        configurable: true,
      });

      link.click();
      await screen.findByRole("heading", { name: "A story" });
      expect(location.hash).toBe("#items/1");
      Object.defineProperty(window, "scrollY", {
        value: 0,
        configurable: true,
      });
      screen.getByRole("button", { name: "Back to Inbox" }).click();

      await screen.findByRole("link", { name: "A story" });
      expect(location.hash).toBe("#inbox");
      await waitFor(() => {
        expect(scrolledTo.at(-1)).toBe(640);
      });
    });

    it("goes Home from an Item opened straight from an Alert", async () => {
      api.items = [STORY];
      await renderShell(root, api, () => undefined, { openItemId: 1 });
      expect(location.hash).toBe("#items/1");
      const entries = history.length;

      screen.getByRole("button", { name: "Back to Home" }).click();

      await waitFor(() => {
        expect(currentScreen()).toEqual(["Home"]);
      });
      expect(location.hash).toBe("#home");
      // Replaced, not added: Back from Home doesn't return to the Item.
      expect(history.length).toBe(entries);
    });

    it("gives an opened Briefing its own address, and its back button goes back", async () => {
      api.briefingsAnswer = [
        {
          id: 5,
          scope: "all-24h",
          title: "All Sources, last 24 hours",
          createdAt: "2026-10-12T00:30:00+00:00",
          itemCount: 1,
          costUsd: "0.20",
        },
      ];
      api.savedBriefings.set(5, {
        ...api.briefingsAnswer[0],
        sections: [],
      } as never);
      await renderShell(root, api, () => undefined);
      screen.getByRole("button", { name: "Briefings" }).click();

      (await screen.findByRole("link", { name: /last 24 hours/ })).click();
      await screen.findByRole("button", { name: "Back to Briefings" });
      expect(location.hash).toBe("#briefings/5");

      screen.getByRole("button", { name: "Back to Briefings" }).click();
      await screen.findByRole("list", { name: "Saved Briefings" });
      expect(location.hash).toBe("#briefings");
    });
  });
});
