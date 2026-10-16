import {
  SignedOutError,
  type ApiClient,
  type InboxItem,
  type InboxOrder,
  type InboxQuery,
  type InboxReadFilter,
} from "../api/client";
import { renderChatPanel, type ChatPanelOptions } from "./chat";
import { inboxContents } from "./inbox-contents";
import { itemRow, rowId } from "./inbox-row";
import { toggleGroup } from "./toggle-group";

export type InboxChat = Pick<
  ChatPanelOptions,
  "openChatId" | "onChatOpened" | "quote" | "open"
>;

const ALL_FOLDERS = "";
const ANY_IMPORTANCE = "";

// The Inbox: the unread Items (or the read ones, or all) latest first or most important first,
// a keyword search, filters by Folder and Importance, and a button for the next page. Choosing
// an Item calls onOpen with its id and the loaded Items' ids in order, so the Item view can move
// on to the next one. Items can be ticked, and "Brief these" calls onBriefThese with their ids.
// A Contents panel lists the loaded Items and jumps to the chosen one's row.
// Given folderId (a Folder picked in the sidebar), it opens filtered to that Folder. The Chat
// panel sits beside it, its Source buttons and "Brief these" going to the same callbacks; it
// reopens chat.openChatId and reports the Chat it shows.
export async function renderInbox(
  root: HTMLElement,
  api: ApiClient,
  onOpen: (itemId: number, listedIds?: number[]) => void,
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
  const shownRead = toggleGroup<InboxReadFilter>(
    "Show",
    [
      ["unread", "Unread"],
      ["read", "Read"],
      ["all", "All"],
    ],
    "unread",
    () => {
      applyFilters();
    },
  );
  const order = toggleGroup<InboxOrder>(
    "Sort",
    [
      ["newest", "Latest"],
      ["importance", "Importance"],
    ],
    "newest",
    () => {
      applyFilters();
    },
  );
  const views = document.createElement("div");
  views.className = "toolbar inbox-views";
  views.append(shownRead.group, order.group);
  const filters = document.createElement("div");
  filters.className = "toolbar";
  filters.append(
    labelled("Folder", filter),
    labelled("Importance", importanceFilter),
  );
  const list = document.createElement("ul");
  list.className = "inbox-list";
  // Why the Folders didn't load.
  const problem = document.createElement("p");
  problem.setAttribute("role", "alert");
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
  const contents = inboxContents((itemId) => {
    jumpToRow(list, itemId);
  });
  const actions = document.createElement("div");
  actions.className = "toolbar";
  actions.append(briefThese, contents.toggle);
  const column = document.createElement("div");
  column.className = "inbox-column";
  column.append(
    views,
    searchForm,
    filters,
    actions,
    problem,
    list,
    status,
    loadMore,
  );
  const chatPanel = document.createElement("aside");
  const layout = document.createElement("div");
  layout.className = "inbox-layout";
  layout.append(column, chatPanel, contents.panel);
  root.replaceChildren(layout);

  let query: InboxQuery =
    folderId === undefined ? { read: "unread" } : { read: "unread", folderId };
  let nextCursor: string | null = null;
  // The Items in the list, in order, for the Contents panel.
  let shown: InboxItem[] = [];

  const openListed = (itemId: number): void => {
    onOpen(
      itemId,
      shown.map((item) => item.id),
    );
  };
  const row = (item: InboxItem): HTMLLIElement =>
    itemRow(item, picked.has(item.id), { onOpen: openListed, onPick });
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
      const rows = page.items.map(row);
      if (append) list.append(...rows);
      else list.replaceChildren(...rows);
      shown = append ? [...shown, ...page.items] : page.items;
      contents.show(page.items, append);
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
    query = { read: shownRead.value() };
    const search = searchBox.value.trim();
    if (search !== "") query.search = search;
    if (filter.value !== ALL_FOLDERS) query.folderId = Number(filter.value);
    if (importanceFilter.value !== ANY_IMPORTANCE) {
      query.minImportance = Number(importanceFilter.value);
    }
    if (order.value() === "importance") query.sort = "importance";
    void load(false);
  }

  for (const select of [filter, importanceFilter]) {
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
    fillFolders(api, filter, problem).then(() => {
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
  if (query.folderId !== undefined || query.minImportance !== undefined) {
    return "No Items match these filters.";
  }
  if (query.read === "unread") return "All caught up: nothing unread.";
  if (query.read === "read") return "Nothing read yet.";
  return "No Items yet. Sources are checked every few minutes.";
}

// Scrolls the Item's row into view and focuses its title, so the keyboard carries on from there.
function jumpToRow(list: HTMLElement, itemId: number): void {
  const row = list.querySelector<HTMLElement>(`#${rowId(itemId)}`);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "start" });
  row.querySelector("a")?.focus({ preventScroll: true });
}
