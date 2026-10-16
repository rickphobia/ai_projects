import type { InboxItem } from "../api/client";
import { relativeTime, shownTime } from "./shown-time";
import { stockTags } from "./stock-tags";

export function rowId(itemId: number): string {
  return `inbox-item-${String(itemId)}`;
}

export interface RowActions {
  onOpen: (itemId: number) => void;
  onPick: (itemId: number, ticked: boolean) => void;
  // The Read button: marks the Item read, or unread again when it is read.
  onToggleRead: (item: InboxItem) => void;
}

// One Inbox row: a tick for "Brief these", the title as a heading linking to the Item view,
// the one-line summary, Source and time, the Read button, a thumbnail and the Importance.
export function itemRow(
  item: InboxItem,
  ticked: boolean,
  actions: RowActions,
): HTMLLIElement {
  const { onOpen, onPick, onToggleRead } = actions;
  const row = document.createElement("li");
  row.id = rowId(item.id);
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
  // Each title is a heading, so the rows read as separate stories and can be jumped between.
  const title = document.createElement("h2");
  title.className = "inbox-row-title";
  const link = document.createElement("a");
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
    title.append(unread);
  }
  title.append(link);
  body.append(title);
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
  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.className = "row-read";
  readButton.textContent = item.read ? "Mark unread" : "✓ Read";
  readButton.setAttribute(
    "aria-label",
    `Mark ${item.title} ${item.read ? "unread" : "read"}`,
  );
  readButton.addEventListener("click", () => {
    readButton.disabled = true;
    onToggleRead(item);
  });
  details.append(readButton);
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
