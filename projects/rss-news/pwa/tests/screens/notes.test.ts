import { screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefusedError } from "../../src/api/client";
import type { Note, NoteLink } from "../../src/api/notes";
import { renderNotes } from "../../src/screens/notes";
import { FakeApiClient } from "../fake-api";

const ON_ITEM: Note = {
  id: 2,
  createdAt: "2026-10-12T12:00:00+00:00",
  text: "kept the OPR at 2.75%",
  comment: "check next month",
  source: {
    kind: "item",
    id: 7,
    title: "Item: BNM holds rates (The Star)",
    exists: true,
  },
};
const ON_GONE_ITEM: Note = {
  id: 1,
  createdAt: "2026-09-01T12:00:00+00:00",
  text: "Ringgit rises",
  comment: "",
  source: {
    kind: "item",
    id: 3,
    title: "Item: Ringgit rises (Reuters)",
    exists: false,
  },
};

describe("the Notes screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;
  let opened: NoteLink[];

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.savedNotes = [ON_ITEM, ON_GONE_ITEM];
    opened = [];
  });

  const show = (): Promise<void> =>
    renderNotes(root, api, (link) => opened.push(link));

  const rows = (): HTMLElement[] =>
    within(screen.getByRole("list", { name: "Notes" })).getAllByRole(
      "listitem",
    );
  const row = (index: number): HTMLElement => {
    const found = rows()[index];
    if (found === undefined) throw new Error(`no Note row ${String(index)}`);
    return found;
  };

  it("lists Notes newest first with their text and comment", async () => {
    await show();

    expect(rows()).toHaveLength(2);
    expect(rows()[0]?.querySelector("blockquote")?.textContent).toBe(
      "kept the OPR at 2.75%",
    );
    expect(
      within(row(0)).getByRole<HTMLTextAreaElement>("textbox", {
        name: "Comment",
      }).value,
    ).toBe("check next month");
  });

  it("links back to where a Note came from", async () => {
    await show();

    within(row(0))
      .getByRole("link", { name: "Item: BNM holds rates (The Star)" })
      .click();

    expect(opened).toEqual([{ kind: "item", id: 7 }]);
  });

  it("keeps the text of a Note whose Item is gone and says so", async () => {
    await show();

    const gone = row(1);
    expect(within(gone).queryByRole("link")).toBeNull();
    expect(gone.textContent).toContain("Ringgit rises");
    expect(gone.textContent).toContain(
      "Item: Ringgit rises (Reuters) (this Item is gone)",
    );
  });

  it("saves a changed comment", async () => {
    await show();
    const first = row(0);

    within(first).getByRole<HTMLTextAreaElement>("textbox", {
      name: "Comment",
    }).value = " ask Chat ";
    within(first).getByRole("button", { name: "Save comment" }).click();

    await waitFor(() => {
      expect(api.changes).toEqual([["changeNoteComment", 2, "ask Chat"]]);
    });
    expect(api.savedNotes[0]?.comment).toBe("ask Chat");
  });

  it("deletes a Note", async () => {
    await show();

    within(row(1)).getByRole("button", { name: "Delete" }).click();

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(api.changes).toEqual([["deleteNote", 1]]);
  });

  it("says why a Note couldn't be deleted and keeps it", async () => {
    api.changeError = new RefusedError("no Note has id 1");
    await show();

    within(row(1)).getByRole("button", { name: "Delete" }).click();

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Notes status" }).textContent,
      ).toBe("Couldn't delete the Note: no Note has id 1");
    });
    expect(rows()).toHaveLength(2);
  });

  it("exports every Note as a Markdown file", async () => {
    const clicked: string[] = [];
    URL.createObjectURL = vi.fn(() => "blob:notes");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });
    await show();

    screen.getByRole("button", { name: "Export as Markdown" }).click();

    await waitFor(() => {
      expect(clicked).toEqual(["notes.md"]);
    });
    vi.restoreAllMocks();
  });

  it("says when there are no Notes yet", async () => {
    api.savedNotes = [];

    await show();

    expect(
      screen.getByRole("status", { name: "Notes status" }).textContent,
    ).toContain("No Notes yet.");
  });
});
