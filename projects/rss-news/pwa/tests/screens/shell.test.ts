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
