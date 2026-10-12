import type { Briefing } from "../api/briefings";
import { shownTime } from "./shown-time";

// One Briefing grouped by Folder, each point linking the Items it came from. Home and the
// Briefings list both show it.
export function showBriefing(
  shown: HTMLElement,
  briefing: Briefing,
  onOpenItem: (itemId: number) => void,
): void {
  const title = document.createElement("h2");
  title.textContent = `Briefing of ${shownTime.format(new Date(briefing.createdAt))}`;
  const details = document.createElement("p");
  details.textContent = `${briefing.title} · ${String(briefing.itemCount)} Items · cost $${briefing.costUsd}`;
  shown.replaceChildren(title, details);
  for (const section of briefing.sections) {
    const heading = document.createElement("h3");
    heading.textContent = section.folder.name;
    const points = document.createElement("ul");
    for (const point of section.points) {
      const row = document.createElement("li");
      row.append(point.text);
      for (const item of point.items) {
        row.append(" ", itemLink(item.id, item.source, item.title, onOpenItem));
      }
      points.append(row);
    }
    shown.append(heading, points);
  }
}

function itemLink(
  itemId: number,
  source: string,
  title: string,
  onOpenItem: (itemId: number) => void,
): HTMLAnchorElement {
  const link = document.createElement("a");
  // A real link, so it can be focused and read out; the Item view opens in the app.
  link.href = `#items/${String(itemId)}`;
  link.textContent = source;
  link.title = title;
  link.setAttribute("aria-label", `${source}: ${title}`);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenItem(itemId);
  });
  return link;
}
