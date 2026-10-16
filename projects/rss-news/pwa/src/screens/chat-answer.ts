import type { ChatAnswerItem, ChatMessage } from "../api/chats";
import { offerSelection } from "./selection";
import { relativeTime, shownTime } from "./shown-time";

export function questionRow(text: string): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "chat-question";
  row.textContent = text;
  return row;
}

// An answer: its intro line, then a card per Item with its title as a heading linking to the
// Item view, what the answer says about it, and its Source, Importance and age; then "Brief
// these". Opening an Item passes the answer's Items in order, so the Item view can go on to the
// next one.
export function answerRow(
  message: ChatMessage,
  chatId: number | null,
  onOpenItem: (itemId: number, listedIds: number[]) => void,
  onBriefThese: (itemIds: number[]) => void,
): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "chat-answer";
  offerSelection(
    row,
    "a Chat answer",
    chatId === null ? undefined : { kind: "chat", id: chatId },
  );
  const intro = document.createElement("p");
  intro.className = "chat-intro";
  intro.textContent = message.text;
  row.append(intro);
  if (message.items.length === 0) return row;
  const ids = message.items.map((item) => item.id);
  const items = document.createElement("ul");
  items.className = "chat-items";
  items.append(
    ...message.items.map((item) =>
      itemCard(item, () => {
        onOpenItem(item.id, ids);
      }),
    ),
  );
  const briefThese = document.createElement("button");
  briefThese.type = "button";
  briefThese.textContent = `Brief these (${String(ids.length)})`;
  briefThese.addEventListener("click", () => {
    onBriefThese(ids);
  });
  row.append(items, briefThese);
  return row;
}

function itemCard(item: ChatAnswerItem, onOpen: () => void): HTMLLIElement {
  const card = document.createElement("li");
  card.className = "chat-item";
  const heading = document.createElement("h3");
  heading.className = "chat-item-title";
  const link = document.createElement("a");
  // A real link, so it can be focused and read out; the Item view opens in the app.
  link.href = `#items/${String(item.id)}`;
  link.textContent = item.title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen();
  });
  heading.append(link);
  card.append(heading);
  if (item.summary !== null) {
    const summary = document.createElement("p");
    summary.className = "chat-item-summary";
    summary.textContent = item.summary;
    card.append(summary);
  }
  const meta = document.createElement("small");
  meta.className = "chat-item-meta";
  meta.append(item.source);
  if (item.importance !== null) {
    meta.append(` · Importance ${String(item.importance)}`);
  }
  if (item.publishedAt !== null) {
    const published = new Date(item.publishedAt);
    const time = document.createElement("time");
    time.dateTime = item.publishedAt;
    time.title = shownTime.format(published);
    time.textContent = relativeTime(published, new Date());
    meta.append(" · ", time);
  }
  card.append(meta);
  return card;
}
