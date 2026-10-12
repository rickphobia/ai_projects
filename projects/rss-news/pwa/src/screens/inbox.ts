import {
  SignedOutError,
  type ApiClient,
  type InboxItem,
  type InboxQuery,
} from "../api/client";

const ALL_FOLDERS = "";

const shownTime = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// The Inbox: every Item newest first, a Folder filter, and a button for the next page.
export async function renderInbox(
  root: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const label = document.createElement("label");
  label.textContent = "Folder";
  const filter = document.createElement("select");
  filter.append(new Option("All folders", ALL_FOLDERS));
  label.append(filter);
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
  root.replaceChildren(label, folderError, list, status, loadMore);

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
      const rows = page.items.map(itemRow);
      if (append) list.append(...rows);
      else list.replaceChildren(...rows);
      nextCursor = page.nextCursor;
      loadMore.hidden = nextCursor === null;
      status.textContent =
        list.childElementCount === 0
          ? "No Items yet. Sources are checked every few minutes."
          : "";
    } catch (error) {
      if (thisLoad !== latestLoad || error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      status.textContent = `Couldn't load the Inbox: ${detail}`;
    } finally {
      loadMore.disabled = false;
    }
  }

  filter.addEventListener("change", () => {
    query =
      filter.value === ALL_FOLDERS ? {} : { folderId: Number(filter.value) };
    void load(false);
  });
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

function itemRow(item: InboxItem): HTMLLIElement {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title;
  const details = document.createElement("small");
  details.textContent = ` ${item.source} · ${shownTime.format(new Date(item.publishedAt))}`;
  row.append(link, details);
  return row;
}
