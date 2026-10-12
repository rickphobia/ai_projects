import {
  SignedOutError,
  type ApiClient,
  type InboxItem,
  type InboxQuery,
} from "../api/client";
import { renderChatPanel, type ChatPanelOptions } from "./chat";
import { relativeTime, shownTime } from "./shown-time";
import { stockTags } from "./stock-tags";

export type InboxChat = Pick<
  ChatPanelOptions,
  "openChatId" | "onChatOpened" | "quote" | "open"
>;

const ALL_FOLDERS = "";
const ANY_IMPORTANCE = "";

// The Inbox: every Item newest first or most important first, a keyword search, filters by
// Folder and Importance, and a button for the next page. Unread Items are marked; choosing one calls
// onOpen with its id. Items can be ticked, and "Brief these" calls onBriefThese with their ids.
// Given folderId (a Folder picked in the sidebar), it opens filtered to that Folder. The Chat
// panel sits beside it, its Source buttons and "Brief these" going to the same callbacks; it
// reopens chat.openChatId and reports the Chat it shows.
export async function renderInbox(
  root: HTMLElement,
  api: ApiClient,
  onOpen: (itemId: number) => void,
  onBriefThese: (itemIds: number[]) => void,
  folderId?: number,
  chat: InboxChat = { openChatId: null },
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
  filters.className = "toolbar";
  filters.append(
    labelled("Folder", filter),
    labelled("Importance", importanceFilter),
    labelled("Sort", order),
  );
  const list = document.createElement("ul");
  list.className = "inbox-list";
  const folderError = document.createElement("p");
  folderError.setAttribute("role", "alert");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Inbox");
  const loadMore = document.createElement("button");
  loadMore.type = "button";
  loadMore.textContent = "Load more";
  loadMore.className = "load-more";
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
  const actions = document.createElement("div");
  actions.className = "toolbar";
  actions.append(briefThese);
  const column = document.createElement("div");
  column.className = "inbox-column";
  column.append(
    searchForm,
    filters,
    actions,
    folderError,
    list,
    status,
    loadMore,
  );
  const chatPanel = document.createElement("aside");
  const layout = document.createElement("div");
  layout.className = "inbox-layout";
  layout.append(column, chatPanel);
  root.replaceChildren(layout);

  let query: InboxQuery = folderId === undefined ? {} : { folderId };
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

  await Promise.all([
    fillFolders(api, filter, folderError).then(() => {
      if (folderId !== undefined) filter.value = String(folderId);
    }),
    load(false),
    renderChatPanel(chatPanel, api, {
      onOpenItem: onOpen,
      onBriefThese,
      ...chat,
    }),
  ]);
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
  row.className = item.read ? "inbox-row" : "inbox-row unread";
  const pick = document.createElement("input");
  pick.type = "checkbox";
  pick.checked = ticked;
  pick.setAttribute("aria-label", `Pick ${item.title}`);
  pick.addEventListener("change", () => {
    onPick(item.id, pick.checked);
  });
  const body = document.createElement("div");
  body.className = "inbox-row-body";
  const link = document.createElement("a");
  link.className = "inbox-row-title";
  // A real link, so it can be focused and read out; the Item view opens in the app.
  link.href = `#items/${String(item.id)}`;
  link.textContent = item.title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen(item.id);
  });
  if (!item.read) {
    const unread = document.createElement("span");
    unread.className = "unread-dot";
    unread.textContent = "●";
    unread.setAttribute("aria-label", "Unread");
    body.append(unread);
  }
  body.append(link);
  if (item.summary !== null) {
    const summary = document.createElement("p");
    summary.className = "inbox-row-summary";
    summary.textContent = item.summary;
    body.append(summary);
  }
  const published = new Date(item.publishedAt);
  const time = document.createElement("time");
  time.dateTime = item.publishedAt;
  time.title = shownTime.format(published);
  time.textContent = relativeTime(published, new Date());
  const details = document.createElement("small");
  details.className = "inbox-row-meta";
  details.append(`${item.source} · `, time);
  const tags = stockTags(item.stocks);
  if (tags) details.append(" ", tags);
  body.append(details);
  row.append(pick, body);
  if (item.imageUrl !== null) {
    row.classList.add("has-thumbnail");
    row.append(thumbnail(item.imageUrl, row));
  }
  row.append(importanceMarker(item.importance));
  return row;
}

// Decorative: the title already says what the Item is, so the image has empty alt text.
// A broken image is dropped and the row falls back to the plain layout.
function thumbnail(imageUrl: string, row: HTMLLIElement): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "inbox-row-thumbnail";
  image.src = imageUrl;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  // The feed's site sees no Referer for the owner's Inbox.
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    image.remove();
    row.classList.remove("has-thumbnail");
  });
  return image;
}

function importanceMarker(importance: number | null): HTMLSpanElement {
  const marker = document.createElement("span");
  marker.className = "importance";
  // Unscored Items wait for the next scoring run; they show a dash until then.
  if (importance === null) {
    marker.textContent = "–";
    marker.setAttribute("aria-label", "Not scored yet");
  } else {
    marker.textContent = String(importance);
    marker.dataset.level = String(importance);
    marker.setAttribute("aria-label", `Importance ${String(importance)}`);
  }
  return marker;
}
