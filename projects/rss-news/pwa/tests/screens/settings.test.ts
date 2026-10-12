import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../src/api/client";
import { renderSettings } from "../../src/screens/settings";
import { renderShell } from "../../src/screens/shell";
import { FakeApiClient } from "../fake-api";

describe("the Settings screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("main");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("shows this month's cost by feature against the limit", async () => {
    await renderSettings(root, api);

    expect(root.textContent).toContain("$12.34 of the $100.00 monthly limit");
    const features = screen.getByRole("list", { name: "Cost by feature" });
    expect(Array.from(features.children, (line) => line.textContent)).toEqual([
      "Scoring: $1.20",
      "Briefings: $11.14",
    ]);
    expect(screen.queryByRole("alert", { name: "Spending" })).toBeNull();
  });

  it("warns from 80% of the limit", async () => {
    api.spendingAnswer = {
      monthStart: "2026-10-01T00:00:00+08:00",
      totalUsd: "82.00",
      limitUsd: "100.00",
      status: "warning",
      byFeature: { scoring: "2.00", briefings: "80.00" },
    };

    await renderSettings(root, api);

    expect(
      screen.getByRole("alert", { name: "Spending" }).textContent,
    ).toContain("$82.00 of the $100.00 monthly limit");
  });

  it("says Briefings are off once the limit is reached", async () => {
    api.spendingAnswer = {
      monthStart: "2026-10-01T00:00:00+08:00",
      totalUsd: "100.40",
      limitUsd: "100.00",
      status: "stopped",
      byFeature: { scoring: "2.00", briefings: "98.40" },
    };

    await renderSettings(root, api);

    expect(
      screen.getByRole("alert", { name: "Spending" }).textContent,
    ).toContain("Briefings are off until next month");
  });

  it("says when spending can't load", async () => {
    api.spendingAnswer = new ApiError("GET api/spending answered 500");

    await renderSettings(root, api);

    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't load spending: GET api/spending answered 500",
    );
  });

  it("is opened from the shell, which shows the warning on every screen", async () => {
    api.spendingAnswer = { ...(await api.spending()), status: "warning" };
    await renderShell(root, api, () => undefined);

    expect(screen.getByRole("alert", { name: "Spending" })).toBeTruthy();
    screen.getByRole("button", { name: "Settings" }).click();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Spending this month" }),
      ).toBeTruthy();
    });
  });
});
