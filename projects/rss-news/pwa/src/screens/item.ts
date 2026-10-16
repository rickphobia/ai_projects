import { SignedOutError, type ApiClient, type InboxItem } from "../api/client";
import { itemEnd, type ItemRun } from "./item-end";
import { showInReadingColumn } from "./reading-column";
import { simpleSummaryButton } from "./simple-summary";
import { offerSelection } from "./selection";
import { shownTime } from "./shown-time";
import { stockTags } from "./stock-tags";

export interface ItemViewOptions extends Partial<
  Pick<ItemRun, "previousId" | "nextId" | "onMove">
> {
  onBack: () => void;
  backLabel?: string;
}

// One Item: its summary, Source, time, Importance and the owner's stocks it mentions at once, a
// Summarise button for a Simple summary of the whole Item, a link to the original page, and
// Reader view loading underneath straight away. Opening it leaves
// it unread; scrolling on past its end marks it read and opens the next Item (see item-end.ts).
// A read Item offers Mark unread.
export async function renderItem(
  root: HTMLElement,
  api: ApiClient,
  itemId: number,
  options: ItemViewOptions,
): Promise<void> {
  const { onBack, backLabel = "Back to Inbox" } = options;
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = backLabel;
  back.addEventListener("click", onBack);
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Item");
  status.textContent = "Loading the Item…";
  const column = showInReadingColumn(root, "article", back, status);

  let item: InboxItem;
  try {
    item = await api.item(itemId);
  } catch (error) {
    if (error instanceof SignedOutError) return;
    status.textContent = `Couldn't open the Item: ${messageOf(error)}`;
    return;
  }
  status.remove();
  offerSelection(column, `Item: ${item.title} (${item.source})`, {
    kind: "item",
    id: item.id,
  });
  const reader = document.createElement("section");
  reader.setAttribute("aria-label", "Reader view");
  reader.className = "prose";
  reader.setAttribute("aria-busy", "true");
  reader.textContent = "Loading the article…";
  column.append(
    itemHeader(item, api),
    reader,
    itemEnd(item, api, {
      previousId: options.previousId ?? null,
      nextId: options.nextId ?? null,
      onMove: options.onMove ?? (() => undefined),
      onBack,
    }),
  );
  await loadReaderView(reader, api, item);
}

function itemHeader(item: InboxItem, api: ApiClient): HTMLElement {
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = item.title;
  const details = document.createElement("p");
  details.className = "item-meta";
  const importance =
    item.importance === null
      ? "Not scored yet"
      : `Importance ${String(item.importance)}`;
  details.textContent = `${item.source} · ${shownTime.format(new Date(item.publishedAt))} · ${importance}`;
  header.append(title, details);
  const tags = stockTags(item.stocks);
  if (tags) header.append(tags);
  if (item.summary !== null) {
    const summary = document.createElement("p");
    summary.className = "item-summary";
    summary.textContent = item.summary;
    header.append(summary);
  }
  const actions = document.createElement("div");
  actions.className = "item-actions";
  if (item.read) actions.append(readButton(item, api, header));
  const simpleSummary = document.createElement("section");
  actions.append(
    simpleSummaryButton(item.id, api, simpleSummary),
    originalLink(item.url),
  );
  header.append(actions, simpleSummary);
  return header;
}

// For a read Item: Mark unread, then "✓ Read" to undo that. A failure is said under it.
function readButton(
  item: InboxItem,
  api: ApiClient,
  header: HTMLElement,
): HTMLButtonElement {
  let read = item.read;
  const button = document.createElement("button");
  button.type = "button";
  const show = (): void => {
    button.textContent = read ? "Mark unread" : "✓ Read";
  };
  show();
  const toggle = async (): Promise<void> => {
    button.disabled = true;
    header.querySelector('[role="alert"]')?.remove();
    try {
      if (read) await api.markUnread(item.id);
      else await api.markRead(item.id);
      button.disabled = false;
      read = !read;
      show();
    } catch (error) {
      button.disabled = false;
      if (error instanceof SignedOutError) return;
      const problem = document.createElement("p");
      problem.setAttribute("role", "alert");
      problem.textContent = `Couldn't mark it ${read ? "unread" : "read"}: ${messageOf(error)}`;
      header.append(problem);
    }
  };
  button.addEventListener("click", () => void toggle());
  return button;
}

async function loadReaderView(
  reader: HTMLElement,
  api: ApiClient,
  item: InboxItem,
): Promise<void> {
  try {
    const view = await api.readerView(item.id);
    const paragraphs = view.text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        return paragraph;
      });
    if (view.problem === null) {
      reader.replaceChildren(...paragraphs);
    } else {
      // Some sites, such as Reddit, refuse the server; the feed's preview is what's left.
      const note = document.createElement("p");
      note.className = "reader-note";
      note.textContent =
        paragraphs.length > 0
          ? `Couldn't load the full article (${view.problem}). This is the preview from the feed.`
          : `No article to show (${view.problem}). Open the original page to see it.`;
      reader.replaceChildren(note, ...paragraphs, originalLink(item.url));
    }
  } catch (error) {
    if (error instanceof SignedOutError) return;
    // Never a dead end: say why and offer the original page.
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = messageOf(error);
    reader.replaceChildren(message, originalLink(item.url));
  } finally {
    reader.removeAttribute("aria-busy");
  }
}

function originalLink(url: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open the original page";
  return link;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
