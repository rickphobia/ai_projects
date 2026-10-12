import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";

import { RefusedError } from "../../src/api/client";
import { renderStocks } from "../../src/screens/stocks";
import { FakeApiClient } from "../fake-api";

function addTicker(typed: string): void {
  fireEvent.input(screen.getByRole("textbox", { name: "Ticker" }), {
    target: { value: typed },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Add to the Watchlist" }));
}

function watchlist(): string[] {
  return within(screen.getByRole("list", { name: "Watchlist" }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("strong")?.textContent ?? "");
}

describe("the Stocks screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("adds a ticker to the Watchlist and lists it", async () => {
    await renderStocks(root, api);
    expect(screen.getByText("No stocks on the Watchlist yet.")).toBeTruthy();

    addTicker(" 1155.kl ");

    await waitFor(() => {
      expect(watchlist()).toEqual(["1155.KL"]);
    });
    expect(api.changes).toEqual([["watchStock", "1155.kl"]]);
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Ticker" }).value,
    ).toBe("");
  });

  it("shows why the server refused a ticker and keeps what was typed", async () => {
    await renderStocks(root, api);
    api.changeError = new RefusedError(
      "'MAYBANK' isn't a ticker: use a US one such as NVDA or BRK-B, or a Bursa one such as 1155.KL",
    );

    addTicker("MAYBANK");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("1155.KL");
    });
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Ticker" }).value,
    ).toBe("MAYBANK");
    expect(screen.getByText("No stocks on the Watchlist yet.")).toBeTruthy();
  });

  it("removes a stock from the Watchlist", async () => {
    api.ownerStocks.watchlist = [
      { ticker: "NVDA", addedAt: "2026-10-12T20:00:00+08:00" },
      { ticker: "1155.KL", addedAt: "2026-10-12T21:00:00+08:00" },
    ];
    await renderStocks(root, api);

    fireEvent.click(screen.getByRole("button", { name: "Remove NVDA" }));

    await waitFor(() => {
      expect(watchlist()).toEqual(["1155.KL"]);
    });
    expect(api.changes).toEqual([["unwatchStock", "NVDA"]]);
  });

  it("shows only the Watchlist, with no Holdings", async () => {
    await renderStocks(root, api);

    expect(screen.queryByRole("list", { name: "Holdings" })).toBeNull();
    expect(screen.queryByText(/Holdings/)).toBeNull();
  });
});
