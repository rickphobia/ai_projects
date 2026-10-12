import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError, type Folder, type InboxItem } from "../../src/api/client";
import { renderInbox } from "../../src/screens/inbox";
import { FakeApiClient } from "../fake-api";

const AI: Folder = { id: 1, name: "AI" };
const WORLD: Folder = { id: 2, name: "World" };

function item(id: number, title: string, folder: Folder): InboxItem {
  return {
    id,
    title,
    url: `https://news.example/${String(id)}`,
    source: `${folder.name} source`,
    folder,
    publishedAt: "2026-10-12T04:00:00+00:00",
  };
}

function shownTitles(): string[] {
  return screen.queryAllByRole("link").map((link) => link.textContent);
}

function folderFilter(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Folder" });
}

function choose(select: HTMLSelectElement, label: string): void {
  const option = Array.from(select.options).find(
    (candidate) => candidate.text === label,
  );
  if (!option) throw new Error(`no option ${label}`);
  select.value = option.value;
  select.dispatchEvent(new Event("change"));
}

describe("the Inbox", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.foldersAnswer = [AI, WORLD];
    api.items = [
      item(3, "Newest world story", WORLD),
      item(2, "AI story", AI),
      item(1, "Older world story", WORLD),
    ];
  });

  it("lists every Item newest first, each linking to the original", async () => {
    await renderInbox(root, api);

    expect(shownTitles()).toEqual([
      "Newest world story",
      "AI story",
      "Older world story",
    ]);
    const link = screen.getByRole("link", { name: "AI story" });
    expect(link.getAttribute("href")).toBe("https://news.example/2");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/AI source/)).toBeTruthy();
  });

  it("filters by Folder and back to all Folders", async () => {
    await renderInbox(root, api);
    const filter = folderFilter();
    expect(Array.from(filter.options).map((option) => option.text)).toEqual([
      "All folders",
      "AI",
      "World",
    ]);

    choose(filter, "World");
    await waitFor(() => {
      expect(shownTitles()).toEqual([
        "Newest world story",
        "Older world story",
      ]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({ folderId: WORLD.id });

    choose(filter, "All folders");
    await waitFor(() => {
      expect(shownTitles()).toHaveLength(3);
    });
    expect(api.inboxQueries.at(-1)).toEqual({});
  });

  it("loads the next page on request and keeps the Folder filter", async () => {
    api.pageSize = 1;
    await renderInbox(root, api);
    choose(folderFilter(), "World");
    await waitFor(() => {
      expect(shownTitles()).toEqual(["Newest world story"]);
    });

    screen.getByRole("button", { name: "Load more" }).click();

    await waitFor(() => {
      expect(shownTitles()).toEqual([
        "Newest world story",
        "Older world story",
      ]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({
      folderId: WORLD.id,
      cursor: "1",
    });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("says so when there are no Items yet", async () => {
    api.items = [];

    await renderInbox(root, api);

    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toContain(
      "No Items yet",
    );
  });

  it("still lists Items when the Folders can't load", async () => {
    api.foldersAnswer = new ApiError("GET /api/folders answered 500");

    await renderInbox(root, api);

    expect(shownTitles()).toHaveLength(3);
    expect(folderFilter().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't load the Folders: GET /api/folders answered 500",
    );
  });

  it("says what went wrong when the Inbox can't load", async () => {
    api.inboxError = new ApiError("GET /api/inbox answered 500");

    await renderInbox(root, api);

    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
      "Couldn't load the Inbox: GET /api/inbox answered 500",
    );
  });
});
