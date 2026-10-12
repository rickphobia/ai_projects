import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/api/client";
import { renderShell } from "../../src/screens/shell";
import { FakeApiClient } from "../fake-api";

describe("the app shell", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("main");
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

    expect(screen.getByRole("link", { name: "A story" })).toBeTruthy();
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
