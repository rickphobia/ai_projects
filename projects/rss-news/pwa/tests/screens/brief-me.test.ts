import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Briefing } from "../../src/api/briefings";
import { ApiError, RefusedError } from "../../src/api/client";
import { renderBriefMe } from "../../src/screens/brief-me";
import { FakeApiClient } from "../fake-api";

const BRIEFING: Briefing = {
  id: 3,
  scope: "all-24h",
  title: "All Sources, last 24 hours",
  createdAt: "2026-10-12T00:30:00+00:00",
  itemCount: 12,
  costUsd: "0.21",
  sections: [
    {
      folder: { id: 1, name: "Malaysia" },
      points: [
        {
          text: "Bank Negara held the OPR at 2.75%.",
          items: [
            { id: 7, title: "BNM holds rates", source: "The Star" },
            { id: 8, title: "OPR kekal", source: "Berita Harian" },
          ],
        },
      ],
    },
  ],
};

function briefMe(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Brief me/ });
}

function progress(): string {
  return screen.getByRole("status", { name: "Briefing progress" }).textContent;
}

describe("Brief me", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("shows the latest Briefing grouped by Folder, each point linking its Items", async () => {
    api.latestBriefingAnswer = BRIEFING;
    const onOpenItem = vi.fn();

    await renderBriefMe(root, api, onOpenItem);

    expect(screen.getByRole("heading", { name: "Malaysia" })).toBeTruthy();
    expect(screen.getByText(/Bank Negara held the OPR/)).toBeTruthy();
    expect(screen.getByText(/12 Items · cost \$0\.21/)).toBeTruthy();
    screen.getByRole("link", { name: "Berita Harian: OPR kekal" }).click();
    expect(onOpenItem).toHaveBeenCalledWith(8);
  });

  it("says when there is no Briefing yet", async () => {
    await renderBriefMe(root, api, () => undefined);

    expect(
      screen.getByRole("region", { name: "Briefing" }).textContent,
    ).toContain("No Briefing yet");
  });

  it("shows the estimated cost on the button before it is pressed", async () => {
    await renderBriefMe(root, api, () => undefined);

    expect(briefMe().textContent).toBe("Brief me: last 24 hours (about $0.24)");
    expect(briefMe().disabled).toBe(false);
    expect(api.writeRequests).toEqual([]);
  });

  it("won't brief when nothing arrived", async () => {
    api.estimateAnswer = {
      itemCount: 0,
      sectionCount: 0,
      estimatedCostUsd: "0.00",
    };

    await renderBriefMe(root, api, () => undefined);

    expect(briefMe().disabled).toBe(true);
    expect(progress()).toBe("Nothing to brief in the last 24 hours.");
  });

  it("won't brief blind when the estimate fails", async () => {
    api.estimateAnswer = new ApiError(
      "GET /api/briefings/estimate answered 500",
    );

    await renderBriefMe(root, api, () => undefined);

    expect(briefMe().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't work out what a Briefing would cost",
    );
  });

  it("shows progress while writing, then the new Briefing", async () => {
    api.writeAnswers = [
      {
        progress: [
          { step: "reading", section: 1, sections: 2, folder: "AI" },
          { step: "writing", section: 1, sections: 2, folder: "AI" },
        ],
        result: { briefing: BRIEFING, reused: false },
      },
    ];
    api.holdWrite = true;
    await renderBriefMe(root, api, () => undefined);

    briefMe().click();

    await waitFor(() => {
      expect(progress()).toBe("Writing AI (1 of 2)…");
    });
    expect(briefMe().disabled).toBe(true);
    api.releaseWrite?.();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Malaysia" })).toBeTruthy();
    });
    expect(api.writeRequests).toEqual([false]);
    expect(progress()).toBe("");
    expect(screen.queryByRole("button", { name: /Regenerate/ })).toBeNull();
    expect(briefMe().disabled).toBe(false);
  });

  it("shows today's saved Briefing with a Regenerate button and its cost", async () => {
    api.writeAnswers = [
      { progress: [], result: { briefing: BRIEFING, reused: true } },
      {
        progress: [],
        result: { briefing: { ...BRIEFING, id: 4 }, reused: false },
      },
    ];
    await renderBriefMe(root, api, () => undefined);

    briefMe().click();
    const regenerate = await waitFor(() => {
      const found = screen.getByRole("button", {
        name: "Regenerate (about $0.24)",
      });
      expect(found.hidden).toBe(false);
      return found;
    });
    expect(progress()).toContain("today's Briefing, already written");

    regenerate.click();

    await waitFor(() => {
      expect(api.writeRequests).toEqual([false, true]);
    });
    await waitFor(() => {
      expect(regenerate.hidden).toBe(true);
    });
  });

  it("says why a Briefing failed and lets the owner try again", async () => {
    api.writeAnswers = [
      {
        progress: [
          { step: "writing", section: 2, sections: 3, folder: "World" },
        ],
        result: new RefusedError(
          "The Briefing couldn't be written, and nothing was saved: overloaded.",
        ),
      },
    ];
    await renderBriefMe(root, api, () => undefined);

    briefMe().click();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "The Briefing couldn't be written, and nothing was saved: overloaded.",
      );
    });
    expect(progress()).toBe("");
    expect(briefMe().disabled).toBe(false);
  });

  it("re-estimates as the scope and window change, and briefs that scope", async () => {
    api.foldersAnswer = [
      { id: 1, name: "Malaysia" },
      { id: 2, name: "AI" },
    ];
    api.writeAnswers = [
      { progress: [], result: { briefing: BRIEFING, reused: false } },
    ];
    await renderBriefMe(root, api, () => undefined);
    api.estimateAnswer = {
      itemCount: 4,
      sectionCount: 1,
      estimatedCostUsd: "0.09",
    };

    choose("Brief", "AI");
    choose("Over", "Last 7 days");

    await waitFor(() => {
      expect(briefMe().textContent).toBe(
        "Brief me: AI, last 7 days (about $0.09)",
      );
    });
    expect(api.estimateRequests).toEqual([
      { window: "24h" },
      { window: "24h", folderId: 2 },
      { window: "7d", folderId: 2 },
    ]);
    briefMe().click();
    await waitFor(() => {
      expect(api.writeScopes).toEqual([{ window: "7d", folderId: 2 }]);
    });
  });

  it("says when the chosen scope has nothing to brief", async () => {
    api.foldersAnswer = [{ id: 2, name: "AI" }];
    await renderBriefMe(root, api, () => undefined);
    api.estimateAnswer = {
      itemCount: 0,
      sectionCount: 0,
      estimatedCostUsd: "0.00",
    };

    choose("Over", "Last 30 days");

    await waitFor(() => {
      expect(progress()).toBe("Nothing to brief in the last 30 days.");
    });
    expect(briefMe().disabled).toBe(true);
  });

  it("offers a Briefing of exactly the picked Items", async () => {
    api.writeAnswers = [
      { progress: [], result: { briefing: BRIEFING, reused: false } },
    ];
    api.latestBriefingAnswer = { ...BRIEFING, id: 1 };

    await renderBriefMe(root, api, () => undefined, [7, 8]);

    const briefThese = screen.getByRole("button", { name: /^Brief these/ });
    expect(briefThese.textContent).toBe(
      "Brief these: 2 picked Items (about $0.24)",
    );
    expect(screen.queryByRole("combobox", { name: "Brief" })).toBeNull();
    expect(api.estimateRequests).toEqual([{ itemIds: [7, 8] }]);
    briefThese.click();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Malaysia" })).toBeTruthy();
    });
    expect(api.writeScopes).toEqual([{ itemIds: [7, 8] }]);
  });
});

function choose(label: string, optionText: string): void {
  const select = screen.getByRole<HTMLSelectElement>("combobox", {
    name: label,
  });
  const option = Array.from(select.options).find(
    (candidate) => candidate.text === optionText,
  );
  if (!option) throw new Error(`no option ${optionText} in ${label}`);
  select.value = option.value;
  select.dispatchEvent(new Event("change"));
}
