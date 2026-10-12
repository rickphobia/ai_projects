import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/api/client";
import { renderShell } from "../../src/screens/shell";
import { FakeApiClient } from "../fake-api";

describe("the app shell", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

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

  it("Ask AI on an Item's text opens the Inbox Chat with the quote", async () => {
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
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    await renderShell(root, api, () => undefined, { openItemId: 7 });
    const summary = screen.getByText(
      "Malaysia's central bank kept its policy rate at 2.75%.",
    );
    const range = document.createRange();
    range.selectNodeContents(summary);
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));

    const askAi = await screen.findByRole("button", { name: "Ask AI" });
    askAi.click();

    const quoted = await screen.findByRole("figure", { name: "Asking about" });
    expect(quoted.textContent).toContain(
      "From Item: Bank Negara holds rates (The Star)",
    );
    expect(
      screen
        .getByRole("button", { name: "Inbox" })
        .getAttribute("aria-current"),
    ).toBe("page");
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

  it("starts on the home screen with the latest Briefing", async () => {
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

    expect(screen.getByText("A model came out.")).toBeTruthy();
    screen.getByRole("link", { name: "Example: A story" }).click();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "A story" })).toBeTruthy();
    });
    screen.getByRole("button", { name: "Back to Home" }).click();
    await waitFor(() => {
      expect(screen.getByText("A model came out.")).toBeTruthy();
    });
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
    await waitFor(() => {
      expect(screen.queryByLabelText("Unread")).toBeNull();
    });
    expect(screen.getByRole("link", { name: "A story" })).toBeTruthy();
  });

  describe("the Chat in the Inbox", () => {
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
              },
            ],
          },
        },
      ];
    });

    async function askInInbox(): Promise<void> {
      await renderShell(root, api, () => undefined);
      screen.getByRole("button", { name: "Inbox" }).click();
      const box = await screen.findByRole("textbox", {
        name: "Ask about your news",
      });
      (box as HTMLTextAreaElement).value = "What happened in Malaysia?";
      screen.getByRole("button", { name: "Ask" }).click();
      await screen.findByText("Rates held at 2.75%.", { exact: false });
    }

    it("opens an answer's Item from its Source button and comes back to the Chat", async () => {
      await askInInbox();

      screen
        .getByRole("button", { name: "The Star: Bank Negara holds rates" })
        .click();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Bank Negara holds rates" }),
        ).toBeTruthy();
      });
      expect(api.itemsOpened).toEqual([7]);

      screen.getByRole("button", { name: "Back to Inbox" }).click();
      await waitFor(() => {
        expect(screen.getByText("What happened in Malaysia?")).toBeTruthy();
      });
    });

    it("offers a Briefing of exactly an answer's Items from Brief these", async () => {
      await askInInbox();

      const chatPanel = screen.getByRole("complementary", { name: "Chat" });
      within(chatPanel)
        .getByRole("button", { name: "Brief these (1)" })
        .click();

      await waitFor(() => {
        expect(api.estimateRequests).toContainEqual({ itemIds: [7] });
      });
      expect(
        screen
          .getByRole("button", { name: "Home" })
          .getAttribute("aria-current"),
      ).toBe("page");
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
      expect(api.inboxQueries.at(-1)).toEqual({ folderId: 2 });
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
});
