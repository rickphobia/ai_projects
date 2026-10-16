import type { ChatSummary } from "../api/chats";
import { relativeTime, shownTime } from "./shown-time";

// One saved Chat in Earlier Chats (Chat history on Home): its title, and when it was last used.
export function historyRow(
  summary: ChatSummary,
  onChoose: (chatId: number) => Promise<void>,
): HTMLLIElement {
  const choose = document.createElement("button");
  choose.type = "button";
  choose.textContent = summary.title;
  choose.addEventListener("click", () => {
    void onChoose(summary.id);
  });
  const used = new Date(summary.updatedAt);
  const time = document.createElement("time");
  time.dateTime = summary.updatedAt;
  time.title = shownTime.format(used);
  time.textContent = relativeTime(used, new Date());
  const row = document.createElement("li");
  row.append(choose, time);
  return row;
}
