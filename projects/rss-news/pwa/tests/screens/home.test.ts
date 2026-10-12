import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Briefing } from "../../src/api/briefings";
import { ApiError, RefusedError } from "../../src/api/client";
import { renderHome } from "../../src/screens/home";
import { FakeApiClient } from "../fake-api";

const BRIEFING: Briefing = {
  id: 3,
  scope: "all-24h",
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

describe("the home screen", () => {
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

    await renderHome(root, api, onOpenItem);

    expect(screen.getByRole("heading", { name: "Malaysia" })).toBeTruthy();
    expect(screen.getByText(/Bank Negara held the OPR/)).toBeTruthy();
    expect(screen.getByText(/12 Items · cost \$0\.21/)).toBeTruthy();
    screen.getByRole("link", { name: "Berita Harian: OPR kekal" }).click();
    expect(onOpenItem).toHaveBeenCalledWith(8);
  });

  it("says when there is no Briefing yet", async () => {
    await renderHome(root, api, () => undefined);

    expect(
      screen.getByRole("region", { name: "Briefing" }).textContent,
    ).toContain("No Briefing yet");
  });

  it("shows the estimated cost on the button before it is pressed", async () => {
    await renderHome(root, api, () => undefined);

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

    await renderHome(root, api, () => undefined);

    expect(briefMe().disabled).toBe(true);
    expect(progress()).toBe("Nothing arrived in the last 24 hours to brief.");
  });

  it("won't brief blind when the estimate fails", async () => {
    api.estimateAnswer = new ApiError(
      "GET /api/briefings/estimate answered 500",
    );

    await renderHome(root, api, () => undefined);

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
    await renderHome(root, api, () => undefined);

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
    await renderHome(root, api, () => undefined);

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
    await renderHome(root, api, () => undefined);

    briefMe().click();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "The Briefing couldn't be written, and nothing was saved: overloaded.",
      );
    });
    expect(progress()).toBe("");
    expect(briefMe().disabled).toBe(false);
  });
});
