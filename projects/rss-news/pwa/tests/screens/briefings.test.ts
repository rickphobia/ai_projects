import { screen } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Briefing, BriefingSummary } from "../../src/api/briefings";
import { ApiError } from "../../src/api/client";
import {
  renderBriefings,
  renderSavedBriefing,
} from "../../src/screens/briefings";
import { FakeApiClient } from "../fake-api";

const WEEK_SUMMARY: BriefingSummary = {
  id: 5,
  scope: "folder-2-168h",
  title: "AI, last 7 days",
  createdAt: "2026-10-12T04:00:00+00:00",
  itemCount: 9,
  costUsd: "0.30",
};
const WEEK: Briefing = {
  ...WEEK_SUMMARY,
  sections: [
    {
      folder: { id: 2, name: "AI" },
      points: [
        {
          text: "A new model came out.",
          items: [{ id: 7, title: "Model released", source: "AI News" }],
        },
      ],
    },
  ],
};

describe("the Briefings list", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("lists saved Briefings in the order the server gives, newest first", async () => {
    api.briefingsAnswer = [
      WEEK_SUMMARY,
      {
        ...WEEK_SUMMARY,
        id: 4,
        title: "All Sources, last 24 hours",
        itemCount: 30,
      },
    ];

    await renderBriefings(root, api, () => undefined);

    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("AI, last 7 days");
    expect(rows[0]).toContain("9 Items · cost $0.30");
    expect(rows[1]).toContain("All Sources, last 24 hours");
  });

  it("opens a saved Briefing chosen from the list", async () => {
    api.briefingsAnswer = [WEEK_SUMMARY];
    const onOpenBriefing = vi.fn();
    await renderBriefings(root, api, onOpenBriefing);

    screen.getByRole("link", { name: /AI, last 7 days/ }).click();

    expect(onOpenBriefing).toHaveBeenCalledWith(5);
  });

  it("shows a saved Briefing, links its Items, and has a way back", async () => {
    api.savedBriefings.set(5, WEEK);
    const onOpenItem = vi.fn();
    const onBack = vi.fn();
    await renderSavedBriefing(root, api, 5, onOpenItem, onBack);

    expect(
      screen.getByText("A new model came out.", { exact: false }),
    ).toBeTruthy();
    screen.getByRole("link", { name: "AI News: Model released" }).click();
    expect(onOpenItem).toHaveBeenCalledWith(7);
    screen.getByRole("button", { name: "Back to Briefings" }).click();
    expect(onBack).toHaveBeenCalled();
  });

  it("says when there are none yet", async () => {
    await renderBriefings(root, api, () => undefined);

    expect(
      screen.getByRole("status", { name: "Briefings" }).textContent,
    ).toContain("No Briefings yet");
  });

  it("says what went wrong when the list can't load", async () => {
    api.briefingsAnswer = new ApiError("GET /api/briefings answered 500");

    await renderBriefings(root, api, () => undefined);

    expect(screen.getByRole("status", { name: "Briefings" }).textContent).toBe(
      "Couldn't load the Briefings: GET /api/briefings answered 500",
    );
  });
});
