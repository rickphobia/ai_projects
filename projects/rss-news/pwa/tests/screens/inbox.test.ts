import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { ApiError, type Folder, type InboxItem } from "../../src/api/client";
import { renderInbox } from "../../src/screens/inbox";
import { FakeApiClient } from "../fake-api";

const AI: Folder = { id: 1, name: "AI" };
const WORLD: Folder = { id: 2, name: "World" };

function item(
  id: number,
  title: string,
  folder: Folder,
  importance: number | null = null,
): InboxItem {
  return {
    id,
    title,
    url: `https://news.example/${String(id)}`,
    source: `${folder.name} source`,
    folder,
    publishedAt: "2026-10-12T04:00:00+00:00",
    importance,
    summary: importance === null ? null : `Summary of ${title}`,
    read: false,
    imageUrl: null,
    stocks: [],
  };
}

function shownTitles(): string[] {
  return screen.queryAllByRole("link").map((link) => link.textContent);
}

function folderFilter(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Folder" });
}

function importanceFilter(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Importance" });
}

function choose(select: HTMLSelectElement, label: string): void {
  const option = Array.from(select.options).find(
    (candidate) => candidate.text === label,
  );
  if (!option) throw new Error(`no option ${label}`);
  select.value = option.value;
  select.dispatchEvent(new Event("change"));
}

function showOnly(label: "Unread" | "Read" | "All"): void {
  within(screen.getByRole("group", { name: "Show" }))
    .getByRole("button", { name: label })
    .click();
}

describe("the Inbox", () => {
  let root: HTMLElement;
  let api: FakeApiClient;
  let onOpen: (itemId: number) => void;
  let onBriefThese: (itemIds: number[]) => void;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    onOpen = vi.fn();
    onBriefThese = vi.fn();
    api.foldersAnswer = [AI, WORLD];
    api.items = [
      item(3, "Newest world story", WORLD, 2),
      item(2, "AI story", AI, 5),
      item(1, "Older world story", WORLD),
    ];
  });

  it("shows each Item's Importance and one-line summary", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);

    expect(screen.getByLabelText("Importance 5")).toBeTruthy();
    expect(screen.getByText("Summary of AI story")).toBeTruthy();
    expect(screen.getByLabelText("Not scored yet")).toBeTruthy();
  });

  it("filters by Importance, keeping the Folder filter", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
    choose(folderFilter(), "World");
    await waitFor(() => {
      expect(shownTitles()).toHaveLength(2);
    });

    choose(importanceFilter(), "2 and up");

    await waitFor(() => {
      expect(shownTitles()).toEqual(["Newest world story"]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({
      read: "unread",
      folderId: WORLD.id,
      minImportance: 2,
    });

    choose(importanceFilter(), "5 only");
    await waitFor(() => {
      expect(shownTitles()).toEqual([]);
    });
    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
      "No Items match these filters.",
    );
  });

  it("searches by keyword, keeping the Folder filter", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
    choose(folderFilter(), "World");
    await waitFor(() => {
      expect(shownTitles()).toHaveLength(2);
    });

    const box = screen.getByRole("searchbox", { name: "Search" });
    (box as HTMLInputElement).value = "  older  ";
    screen.getByRole("button", { name: "Search" }).click();

    await waitFor(() => {
      expect(shownTitles()).toEqual(["Older world story"]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({
      read: "unread",
      folderId: WORLD.id,
      search: "older",
    });

    (box as HTMLInputElement).value = "nothing like this";
    screen.getByRole("button", { name: "Search" }).click();
    await waitFor(() => {
      expect(shownTitles()).toEqual([]);
    });
    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
      "No Items match this search.",
    );
  });

  it("sorts by Importance or Latest on request", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
    const sort = screen.getByRole("group", { name: "Sort" });
    const latest = within(sort).getByRole("button", { name: "Latest" });
    const importance = within(sort).getByRole("button", { name: "Importance" });
    expect(latest.getAttribute("aria-pressed")).toBe("true");

    importance.click();

    await waitFor(() => {
      expect(shownTitles()).toEqual([
        "AI story",
        "Newest world story",
        "Older world story",
      ]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({
      read: "unread",
      sort: "importance",
    });
    expect(importance.getAttribute("aria-pressed")).toBe("true");
    expect(latest.getAttribute("aria-pressed")).toBe("false");

    latest.click();
    await waitFor(() => {
      expect(shownTitles()[0]).toBe("Newest world story");
    });
    expect(api.inboxQueries.at(-1)).toEqual({ read: "unread" });
  });

  it("lists every Item newest first, each opening the Item view", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);

    expect(shownTitles()).toEqual([
      "Newest world story",
      "AI story",
      "Older world story",
    ]);
    screen.getByRole("link", { name: "AI story" }).click();
    // With the list, so the Item view can go on to the next one.
    expect(onOpen).toHaveBeenCalledWith(2, [3, 2, 1]);
    expect(screen.getByText(/AI source/)).toBeTruthy();
  });

  it("shows only unread Items at first", async () => {
    api.items[1] = { ...api.items[1], read: true } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    expect(shownTitles()).toEqual(["Newest world story", "Older world story"]);
    expect(api.inboxQueries).toEqual([{ read: "unread" }]);
    const show = screen.getByRole("group", { name: "Show" });
    expect(
      within(show)
        .getByRole("button", { name: "Unread" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("marks unread Items only when showing all", async () => {
    api.items[1] = { ...api.items[1], read: true } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    showOnly("All");

    await waitFor(() => {
      expect(shownTitles()).toHaveLength(3);
    });
    expect(api.inboxQueries.at(-1)).toEqual({ read: "all" });
    expect(screen.getAllByLabelText("Unread")).toHaveLength(2);
  });

  it("lists read Items on request", async () => {
    api.items[1] = { ...api.items[1], read: true } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    showOnly("Read");

    await waitFor(() => {
      expect(shownTitles()).toEqual(["AI story"]);
    });
    expect(api.inboxQueries.at(-1)).toEqual({ read: "read" });
    expect(screen.queryByLabelText("Unread")).toBeNull();
  });

  it("says so when nothing is read yet", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);

    showOnly("Read");

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
        "Nothing read yet.",
      );
    });
  });

  it("filters by Folder and back to all Folders", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
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
    expect(api.inboxQueries.at(-1)).toEqual({
      read: "unread",
      folderId: WORLD.id,
    });

    choose(filter, "All folders");
    await waitFor(() => {
      expect(shownTitles()).toHaveLength(3);
    });
    expect(api.inboxQueries.at(-1)).toEqual({ read: "unread" });
  });

  it("loads the next page on request and keeps the Folder filter", async () => {
    api.pageSize = 1;
    await renderInbox(root, api, onOpen, onBriefThese);
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
      read: "unread",
      folderId: WORLD.id,
      cursor: "1",
    });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("says so when there are no Items yet", async () => {
    api.items = [];
    await renderInbox(root, api, onOpen, onBriefThese);
    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
      "All caught up: nothing unread.",
    );

    showOnly("All");

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Inbox" }).textContent,
      ).toContain("No Items yet");
    });
  });

  it("still lists Items when the Folders can't load", async () => {
    api.foldersAnswer = new ApiError("GET /api/folders answered 500");

    await renderInbox(root, api, onOpen, onBriefThese);

    expect(shownTitles()).toHaveLength(3);
    expect(folderFilter().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't load the Folders: GET /api/folders answered 500",
    );
  });

  it("says what went wrong when the Inbox can't load", async () => {
    api.inboxError = new ApiError("GET /api/inbox answered 500");

    await renderInbox(root, api, onOpen, onBriefThese);

    expect(screen.getByRole("status", { name: "Inbox" }).textContent).toBe(
      "Couldn't load the Inbox: GET /api/inbox answered 500",
    );
  });

  it("briefs the ticked Items, keeping ticks across filters", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
    const briefThese = screen.getByRole("button", { name: /^Brief these/ });
    expect(briefThese.textContent).toBe("Brief these (0)");
    expect((briefThese as HTMLButtonElement).disabled).toBe(true);

    screen.getByRole("checkbox", { name: "Pick AI story" }).click();
    choose(folderFilter(), "World");
    await waitFor(() => {
      expect(shownTitles()).not.toContain("AI story");
    });
    screen.getByRole("checkbox", { name: "Pick Older world story" }).click();
    choose(folderFilter(), "All folders");
    await waitFor(() => {
      expect(shownTitles()).toContain("AI story");
    });

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Pick AI story" })
        .checked,
    ).toBe(true);
    expect(briefThese.textContent).toBe("Brief these (2)");
    briefThese.click();
    expect(onBriefThese).toHaveBeenCalledWith([2, 1]);
  });

  it("unticking an Item leaves it out", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);
    const pick = screen.getByRole("checkbox", { name: "Pick AI story" });

    pick.click();
    pick.click();

    expect(
      screen.getByRole("button", { name: /^Brief these/ }).textContent,
    ).toBe("Brief these (0)");
  });

  it("marks each row with the owner's stocks its Item mentions", async () => {
    api.items[0] = {
      ...api.items[0],
      stocks: ["1155.KL", "NVDA"],
    } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    const tags = screen.getAllByLabelText(/^Mentions /);
    expect(tags.map((tag) => tag.getAttribute("aria-label"))).toEqual([
      "Mentions 1155.KL, NVDA",
    ]);
    expect(tags[0]?.textContent).toBe("1155.KLNVDA");
  });

  it("shows a lazy thumbnail only on rows whose Item has an image", async () => {
    api.items[0] = {
      ...api.items[0],
      imageUrl: "https://img.example/3.jpg",
    } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    const thumbnails = root.querySelectorAll("img");
    expect(thumbnails).toHaveLength(1);
    const [thumbnail] = thumbnails;
    expect(thumbnail?.src).toBe("https://img.example/3.jpg");
    expect(thumbnail?.loading).toBe("lazy");
    expect(thumbnail?.closest("li")?.textContent).toContain(
      "Newest world story",
    );
  });

  it("drops a thumbnail that fails to load", async () => {
    api.items[0] = {
      ...api.items[0],
      imageUrl: "https://img.example/broken.jpg",
    } as InboxItem;
    await renderInbox(root, api, onOpen, onBriefThese);

    const thumbnail = root.querySelector("img");
    thumbnail?.dispatchEvent(new Event("error"));

    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".has-thumbnail")).toBeNull();
  });

  it("gives each Item's title its own heading", async () => {
    await renderInbox(root, api, onOpen, onBriefThese);

    const list = root.querySelector<HTMLElement>(".inbox-list");
    if (!list) throw new Error("no Inbox list");
    const headings = within(list)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "●Newest world story",
      "●AI story",
      "●Older world story",
    ]);
  });

  describe("Contents", () => {
    function contentsButton(): HTMLButtonElement {
      return screen.getByRole("button", { name: "Contents" });
    }

    function contents(): HTMLElement {
      return screen.getByRole("navigation", { name: "Contents" });
    }

    function contentsTitles(): string[] {
      return within(contents())
        .getAllByRole("listitem")
        .map((entry) => entry.textContent);
    }

    it("opens from the toolbar and closes with its close button or Escape", async () => {
      await renderInbox(root, api, onOpen, onBriefThese);
      const button = contentsButton();
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(contents().dataset.open).toBe("false");

      button.click();
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(contents().dataset.open).toBe("true");

      within(contents())
        .getByRole("button", { name: "Close Contents" })
        .click();
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(button);

      button.click();
      contents().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(contents().dataset.open).toBe("false");
    });

    it("lists the loaded Items in order", async () => {
      await renderInbox(root, api, onOpen, onBriefThese);

      expect(contentsTitles()).toEqual([
        "Newest world story",
        "AI story",
        "Older world story",
      ]);
    });

    it("jumps to the chosen Item and closes", async () => {
      // jsdom has no scrollIntoView; the mock records which element it was called on.
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      onTestFinished(() => {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      });
      await renderInbox(root, api, onOpen, onBriefThese);
      contentsButton().click();

      within(contents()).getByRole("button", { name: "AI story" }).click();

      const link = screen.getByRole("link", { name: "AI story" });
      expect(scrollIntoView.mock.contexts).toEqual([link.closest("li")]);
      expect(document.activeElement).toBe(link);
      expect(contents().dataset.open).toBe("false");
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("follows Load more and the filters", async () => {
      api.pageSize = 2;
      await renderInbox(root, api, onOpen, onBriefThese);
      expect(contentsTitles()).toEqual(["Newest world story", "AI story"]);

      screen.getByRole("button", { name: "Load more" }).click();
      await waitFor(() => {
        expect(contentsTitles()).toHaveLength(3);
      });

      choose(folderFilter(), "AI");
      await waitFor(() => {
        expect(contentsTitles()).toEqual(["AI story"]);
      });
    });

    it("says so when no Items are loaded", async () => {
      api.items = [];
      await renderInbox(root, api, onOpen, onBriefThese);

      expect(within(contents()).queryAllByRole("listitem")).toEqual([]);
      expect(within(contents()).getByText("No Items to list.")).toBeTruthy();
    });
  });
});
