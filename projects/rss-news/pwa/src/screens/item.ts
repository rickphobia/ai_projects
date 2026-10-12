import { SignedOutError, type ApiClient, type InboxItem } from "../api/client";
import { showInReadingColumn } from "./reading-column";
import { offerSelection } from "./selection";
import { shownTime } from "./shown-time";

// One Item: its summary, Source, time and Importance at once, a link to the original page,
// and Reader view loading underneath straight away. Opening it marks it read.
export async function renderItem(
  root: HTMLElement,
  api: ApiClient,
  itemId: number,
  onBack: () => void,
  backLabel = "Back to Inbox",
): Promise<void> {
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
  column.append(itemHeader(item), reader);
  await loadReaderView(reader, api, item);
}

function itemHeader(item: InboxItem): HTMLElement {
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
  if (item.summary !== null) {
    const summary = document.createElement("p");
    summary.className = "item-summary";
    summary.textContent = item.summary;
    header.append(summary);
  }
  header.append(originalLink(item.url));
  return header;
}

async function loadReaderView(
  reader: HTMLElement,
  api: ApiClient,
  item: InboxItem,
): Promise<void> {
  try {
    const view = await api.readerView(item.id);
    reader.replaceChildren(
      ...view.text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const paragraph = document.createElement("p");
          paragraph.textContent = line;
          return paragraph;
        }),
    );
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
