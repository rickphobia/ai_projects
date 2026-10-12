import {
  SignedOutError,
  type ApiClient,
  type InboxItem,
  type InboxQuery,
} from "../api/client";
import { shownTime } from "./shown-time";

const ALL_FOLDERS = "";
const ANY_IMPORTANCE = "";

// The Inbox: every Item newest first or most important first, a keyword search, filters by
// Folder and Importance, and a button for the next page. Unread Items are marked; choosing one calls
// onOpen with its id. Items can be ticked, and "Brief these" calls onBriefThese with their ids.
export async function renderInbox(
  root: HTMLElement,
  api: ApiClient,
  onOpen: (itemId: number) => void,
  onBriefThese: (itemIds: number[]) => void,
): Promise<void> {
  const filter = document.createElement("select");
  filter.append(new Option("All folders", ALL_FOLDERS));
  const importanceFilter = document.createElement("select");
  importanceFilter.append(
    new Option("Any importance", ANY_IMPORTANCE),
    ...[2, 3, 4].map(
      (level) => new Option(`${String(level)} and up`, String(level)),
    ),
    new Option("5 only", "5"),
  );
  const order = document.createElement("select");
  order.append(
    new Option("Newest first", "newest"),
    new Option("Most important first", "importance"),
  );
  const searchForm = document.createElement("form");
  searchForm.setAttribute("role", "search");
  const searchBox = document.createElement("input");
  searchBox.type = "search";
  searchBox.placeholder = "Words in the title or summary";
  const searchLabel = document.createElement("label");
  searchLabel.textContent = "Search";
  searchLabel.append(searchBox);
  const searchButton = document.createElement("button");
  searchButton.type = "submit";
  searchButton.textContent = "Search";
  searchForm.append(searchLabel, searchButton);
  const filters = document.createElement("div");
  filters.append(
    labelled("Folder", filter),
    labelled("Importance", importanceFilter),
    labelled("Sort", order),
  );
  const list = document.createElement("ul");
  const folderError = document.createElement("p");
  folderError.setAttribute("role", "alert");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Inbox");
  const loadMore = document.createElement("button");
  loadMore.type = "button";
  loadMore.textContent = "Load more";
  loadMore.hidden = true;
  // Ticks stay while the filters change, so Items from several searches can be briefed.
  const picked = new Set<number>();
  const briefThese = document.createElement("button");
  briefThese.type = "button";
  const showPicked = (): void => {
    briefThese.textContent = `Brief these (${String(picked.size)})`;
    briefThese.disabled = picked.size === 0;
  };
  showPicked();
  briefThese.addEventListener("click", () => {
    onBriefThese([...picked]);
  });
  const onPick = (itemId: number, ticked: boolean): void => {
    if (ticked) picked.add(itemId);
    else picked.delete(itemId);
    showPicked();
  };
  root.replaceChildren(
    searchForm,
    filters,
    briefThese,
    folderError,
    list,
    status,
    loadMore,
  );

  let query: InboxQuery = {};
  let nextCursor: string | null = null;
  // Each load gets a number; an answer that arrives after a newer load started is dropped,
  // so a slow page can't land under a different Folder.
  let latestLoad = 0;

  async function load(append: boolean): Promise<void> {
    latestLoad += 1;
    const thisLoad = latestLoad;
    const pageQuery: InboxQuery =
      append && nextCursor !== null ? { ...query, cursor: nextCursor } : query;
    loadMore.disabled = true;
    try {
      const page = await api.inbox(pageQuery);
      if (thisLoad !== latestLoad) return;
      const rows = page.items.map((item) =>
        itemRow(item, onOpen, picked.has(item.id), onPick),
      );
      if (append) list.append(...rows);
      else list.replaceChildren(...rows);
      nextCursor = page.nextCursor;
      loadMore.hidden = nextCursor === null;
      status.textContent =
        list.childElementCount === 0 ? emptyMessage(query) : "";
    } catch (error) {
      if (thisLoad !== latestLoad || error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      status.textContent = `Couldn't load the Inbox: ${detail}`;
    } finally {
      loadMore.disabled = false;
    }
  }

  function applyFilters(): void {
    query = {};
    const search = searchBox.value.trim();
    if (search !== "") query.search = search;
    if (filter.value !== ALL_FOLDERS) query.folderId = Number(filter.value);
    if (importanceFilter.value !== ANY_IMPORTANCE) {
      query.minImportance = Number(importanceFilter.value);
    }
    if (order.value === "importance") query.sort = "importance";
    void load(false);
  }

  for (const select of [filter, importanceFilter, order]) {
    select.addEventListener("change", applyFilters);
  }
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  // Clearing the box (its x button or Escape) shows the whole Inbox again.
  searchBox.addEventListener("search", applyFilters);
  loadMore.addEventListener("click", () => {
    void load(true);
  });

  await Promise.all([fillFolders(api, filter, folderError), load(false)]);
}

async function fillFolders(
  api: ApiClient,
  filter: HTMLSelectElement,
  folderError: HTMLElement,
): Promise<void> {
  try {
    const folders = await api.folders();
    filter.append(
      ...folders.map((folder) => new Option(folder.name, String(folder.id))),
    );
  } catch (error) {
    if (error instanceof SignedOutError) return;
    // The Inbox still works without the filter.
    filter.disabled = true;
    const detail = error instanceof Error ? error.message : String(error);
    folderError.textContent = `Couldn't load the Folders: ${detail}`;
  }
}

function labelled(text: string, select: HTMLSelectElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = text;
  label.append(select);
  return label;
}

function emptyMessage(query: InboxQuery): string {
  if (query.search !== undefined) return "No Items match this search.";
  return query.folderId === undefined && query.minImportance === undefined
    ? "No Items yet. Sources are checked every few minutes."
    : "No Items match these filters.";
}

function itemRow(
  item: InboxItem,
  onOpen: (itemId: number) => void,
  ticked: boolean,
  onPick: (itemId: number, ticked: boolean) => void,
): HTMLLIElement {
  const row = document.createElement("li");
  const pick = document.createElement("input");
  pick.type = "checkbox";
  pick.checked = ticked;
  pick.setAttribute("aria-label", `Pick ${item.title}`);
  pick.addEventListener("change", () => {
    onPick(item.id, pick.checked);
  });
  row.append(pick, " ");
  if (!item.read) {
    const unread = document.createElement("span");
    unread.textContent = "●";
    unread.setAttribute("aria-label", "Unread");
    row.append(unread, " ");
  }
  const importance = document.createElement("span");
  // Unscored Items wait for the next scoring run; they show a dash until then.
  importance.textContent =
    item.importance === null ? "–" : String(item.importance);
  importance.setAttribute(
    "aria-label",
    item.importance === null
      ? "Not scored yet"
      : `Importance ${String(item.importance)}`,
  );
  const link = document.createElement("a");
  // A real link, so it can be focused and read out; the Item view opens in the app.
  link.href = `#items/${String(item.id)}`;
  link.textContent = item.title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen(item.id);
  });
  const details = document.createElement("small");
  details.textContent = ` ${item.source} · ${shownTime.format(new Date(item.publishedAt))}`;
  row.append(importance, " ", link, details);
  if (item.summary !== null) {
    const summary = document.createElement("p");
    summary.textContent = item.summary;
    row.append(summary);
  }
  return row;
}
