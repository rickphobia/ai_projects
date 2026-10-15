import { screen, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import type { Briefing, BriefingItemLink } from "../../src/api/briefings";
import { showBriefing } from "../../src/screens/briefing-view";

function links(count: number): BriefingItemLink[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Story ${String(index + 1)}`,
    source: `Source ${String(index + 1)}`,
  }));
}

const BRIEFING: Briefing = {
  id: 3,
  scope: "all-24h",
  title: "All Sources, last 24 hours",
  createdAt: "2026-10-12T00:30:00+00:00",
  itemCount: 12,
  costUsd: "0.21",
  sections: [
    {
      folder: { id: 1, name: "AI" },
      points: [
        {
          text: "Meta launched Muse Wonder. Its stock rose 3%.",
          items: links(5),
        },
        { text: "One sentence only.", items: links(1) },
      ],
    },
    {
      folder: { id: 2, name: "Malaysia" },
      points: [{ text: "Bank Negara held the OPR.", items: links(2) }],
    },
  ],
};

describe("showBriefing", () => {
  let shown: HTMLElement;
  let onOpenItem: (itemId: number) => void;

  beforeEach(() => {
    shown = document.createElement("section");
    document.body.replaceChildren(shown);
    onOpenItem = vi.fn();
  });

  function section(name: string): HTMLElement {
    return screen.getByRole("region", { name });
  }

  it("shows each point as its own card with its lead sentence in bold", () => {
    showBriefing(shown, BRIEFING, onOpenItem);

    const cards = within(section("AI")).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.querySelector("strong")?.textContent).toBe(
      "Meta launched Muse Wonder.",
    );
    expect(cards[0]?.querySelector("p")?.textContent).toBe(
      "Meta launched Muse Wonder. Its stock rose 3%.",
    );
    expect(cards[1]?.querySelector("strong")).toBeNull();
  });

  it("shows three Source links and the rest behind a button", () => {
    showBriefing(shown, BRIEFING, onOpenItem);
    const card = within(section("AI")).getAllByRole("listitem")[0];
    if (!card) throw new Error("no card");

    expect(within(card).getAllByRole("link")).toHaveLength(3);
    within(card).getByRole("button", { name: "+2 more" }).click();

    expect(within(card).getAllByRole("link")).toHaveLength(5);
    expect(within(card).queryByRole("button")).toBeNull();
    within(card).getByRole("link", { name: "Source 5: Story 5" }).click();
    expect(onOpenItem).toHaveBeenCalledWith(5);
  });

  it("jumps to a Folder from the Folder strip", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    });
    showBriefing(shown, BRIEFING, onOpenItem);

    const strip = screen.getByRole("navigation", { name: "Folders" });
    expect(
      within(strip)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["AI", "Malaysia"]);
    within(strip).getByRole("button", { name: "Malaysia" }).click();

    expect(scrollIntoView.mock.contexts).toEqual([section("Malaysia")]);
  });

  it("leaves the Folder strip out for a one-Folder Briefing", () => {
    showBriefing(
      shown,
      { ...BRIEFING, sections: BRIEFING.sections.slice(1) },
      onOpenItem,
    );

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading", { name: "Malaysia" })).toBeTruthy();
  });
});
