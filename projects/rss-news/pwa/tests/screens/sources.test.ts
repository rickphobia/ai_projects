import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RefusedError,
  type Folder,
  type SourceInfo,
} from "../../src/api/client";
import { renderSources } from "../../src/screens/sources";
import { FakeApiClient } from "../fake-api";

const AI: Folder = { id: 1, name: "AI" };
const WORLD: Folder = { id: 2, name: "World" };

function source(overrides: Partial<SourceInfo>): SourceInfo {
  return {
    id: 7,
    folderId: WORLD.id,
    name: "World News",
    url: "https://world.example/rss",
    paused: false,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    ...overrides,
  };
}

function addSource(typed: string, folder: string): void {
  fireEvent.input(
    screen.getByRole("textbox", { name: "Feed URL or subreddit" }),
    {
      target: { value: typed },
    },
  );
  const select = screen.getByRole<HTMLSelectElement>("combobox", {
    name: "Into Folder",
  });
  select.value = String([AI, WORLD].find((f) => f.name === folder)?.id);
  fireEvent.submit(screen.getByRole("form", { name: "Add a Source" }));
}

describe("the Sources screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.foldersAnswer = [AI, WORLD];
    api.sourcesAnswer = [source({})];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a subreddit by name into the chosen Folder", async () => {
    await renderSources(root, api);

    addSource("r/LocalLLaMA", "AI");

    await waitFor(() => {
      expect(api.changes).toEqual([
        ["addSource", { folderId: AI.id, subreddit: "r/LocalLLaMA" }],
      ]);
    });
  });

  it("adds a pasted feed URL as a feed", async () => {
    await renderSources(root, api);

    addSource(" https://new.example/feed.xml ", "World");

    await waitFor(() => {
      expect(api.changes).toEqual([
        [
          "addSource",
          { folderId: WORLD.id, url: "https://new.example/feed.xml" },
        ],
      ]);
    });
  });

  it("shows the server's reason when a change is refused", async () => {
    api.changeError = new RefusedError(
      "https://x.example isn't an RSS or Atom feed",
    );
    await renderSources(root, api);

    addSource("https://x.example", "AI");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "https://x.example isn't an RSS or Atom feed",
      );
    });
  });

  it("shows when a Source last fetched and that it is failing now", async () => {
    api.sourcesAnswer = [
      source({
        lastSuccessAt: "2026-10-12T04:00:00+00:00",
        lastErrorAt: "2026-10-12T05:00:00+00:00",
        lastError: "http status: answered 503",
      }),
    ];

    await renderSources(root, api);

    const row = screen.getByText("World News").parentElement;
    expect(row?.textContent).toContain("Last fetched");
    expect(row?.textContent).toContain("Failing");
    expect(row?.textContent).toContain("http status: answered 503");
  });

  it("moves, pauses and removes a Source", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderSources(root, api);

    const move = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Folder of World News",
    });
    move.value = String(AI.id);
    fireEvent.change(move);
    await waitFor(() => {
      expect(api.changes).toHaveLength(1);
    });
    screen.getByRole("button", { name: "Pause World News" }).click();
    await waitFor(() => {
      expect(api.changes).toHaveLength(2);
    });
    screen.getByRole("button", { name: "Remove World News" }).click();

    await waitFor(() => {
      expect(api.changes).toEqual([
        ["changeSource", 7, { folderId: AI.id }],
        ["changeSource", 7, { paused: true }],
        ["removeSource", 7],
      ]);
    });
  });

  it("keeps a Source when removing it isn't confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderSources(root, api);

    screen.getByRole("button", { name: "Remove World News" }).click();

    expect(api.changes).toEqual([]);
  });

  it("adds, renames and deletes Folders", async () => {
    await renderSources(root, api);

    fireEvent.input(screen.getByRole("textbox", { name: "New Folder" }), {
      target: { value: "Macro" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add a Folder" }));
    await waitFor(() => {
      expect(api.changes).toHaveLength(1);
    });
    fireEvent.input(screen.getByRole("textbox", { name: "Folder name AI" }), {
      target: { value: "Models" },
    });
    screen.getByRole("button", { name: "Rename AI" }).click();
    await waitFor(() => {
      expect(api.changes).toHaveLength(2);
    });
    screen.getByRole("button", { name: "Delete World" }).click();

    await waitFor(() => {
      expect(api.changes).toEqual([
        ["addFolder", "Macro"],
        ["renameFolder", AI.id, "Models"],
        ["deleteFolder", WORLD.id],
      ]);
    });
  });

  it("says when something changed, so the sidebar's Folders can follow", async () => {
    const onChanged = vi.fn();
    await renderSources(root, api, onChanged);
    expect(onChanged).not.toHaveBeenCalled();

    fireEvent.input(screen.getByRole("textbox", { name: "New Folder" }), {
      target: { value: "Macro" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add a Folder" }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
  });
});
