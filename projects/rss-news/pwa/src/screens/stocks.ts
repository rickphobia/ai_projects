import { SignedOutError, type ApiClient } from "../api/client";
import type { OwnerStocks } from "../api/stocks";

// The owner's stocks: add a US or Bursa ticker to the Watchlist, remove one, and see the
// Holdings, which come from IBKR and can't be edited here. Every stock gets its own news
// Source in the Stocks Folder, which the server adds and removes with it.
export async function renderStocks(
  root: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const problem = document.createElement("p");
  problem.setAttribute("role", "alert");
  const addForm = document.createElement("form");
  addForm.setAttribute("aria-label", "Add to the Watchlist");
  const ticker = document.createElement("input");
  ticker.type = "text";
  ticker.setAttribute("aria-label", "Ticker");
  ticker.placeholder = "NVDA or 1155.KL";
  ticker.autocapitalize = "characters";
  ticker.spellcheck = false;
  const add = document.createElement("button");
  add.type = "submit";
  add.textContent = "Add";
  const tickerLabel = document.createElement("label");
  tickerLabel.textContent = "Ticker";
  tickerLabel.append(ticker);
  addForm.append(tickerLabel, add);
  const hint = document.createElement("small");
  hint.textContent =
    "Each stock gets its own news Source in the Stocks Folder, and Items that mention it are marked in the Inbox.";
  const watchlist = document.createElement("ul");
  watchlist.setAttribute("aria-label", "Watchlist");
  watchlist.className = "rows";
  const holdings = document.createElement("ul");
  holdings.setAttribute("aria-label", "Holdings");
  holdings.className = "rows";
  root.replaceChildren(
    sectionHeading("Watchlist"),
    problem,
    addForm,
    paragraph(hint),
    watchlist,
    sectionHeading("Holdings"),
    holdings,
  );

  // Every change reloads the lists, so the screen always shows what the server holds.
  async function act(change: () => Promise<unknown>): Promise<void> {
    problem.textContent = "";
    try {
      await change();
    } catch (error) {
      if (error instanceof SignedOutError) return;
      problem.textContent =
        error instanceof Error ? error.message : String(error);
    }
    await reload();
  }

  async function reload(): Promise<void> {
    let stocks: OwnerStocks;
    try {
      stocks = await api.stocks();
    } catch (error) {
      if (error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      problem.textContent = `Couldn't load the stocks: ${detail}`;
      return;
    }
    watchlist.replaceChildren(
      ...(stocks.watchlist.length === 0
        ? [emptyRow("No stocks on the Watchlist yet.")]
        : stocks.watchlist.map((stock) => {
            const row = document.createElement("li");
            const name = document.createElement("strong");
            name.textContent = stock.ticker;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${stock.ticker}`);
            remove.addEventListener("click", () => {
              void act(() => api.unwatchStock(stock.ticker));
            });
            row.append(name, remove);
            return row;
          })),
    );
    holdings.replaceChildren(
      ...(stocks.holdings.length === 0
        ? [emptyRow("No Holdings yet: they are read from IBKR.")]
        : stocks.holdings.map((holding) => {
            const row = document.createElement("li");
            row.textContent = holding;
            return row;
          })),
    );
  }

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const typed = ticker.value.trim();
    if (!typed) return;
    void act(async () => {
      await api.watchStock(typed);
      ticker.value = "";
    });
  });

  await reload();
}

function emptyRow(text: string): HTMLLIElement {
  const note = document.createElement("small");
  note.textContent = text;
  const row = document.createElement("li");
  row.append(note);
  return row;
}

function paragraph(content: HTMLElement): HTMLParagraphElement {
  const element = document.createElement("p");
  element.append(content);
  return element;
}

function sectionHeading(text: string): HTMLHeadingElement {
  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = text;
  return heading;
}
