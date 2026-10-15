import type {
  Briefing,
  BriefingItemLink,
  BriefingPoint,
} from "../api/briefings";
import { splitLeadSentence } from "./lead-sentence";
import { offerSelection } from "./selection";
import { shownTime } from "./shown-time";

// Source links shown under a point before "+N more"; a big story can have twenty.
const SHOWN_SOURCES = 3;

// One Briefing grouped by Folder, each point a card linking the Items it came from. A strip
// of Folder buttons jumps between sections. Home and the Briefings list both show it.
export function showBriefing(
  shown: HTMLElement,
  briefing: Briefing,
  onOpenItem: (itemId: number) => void,
): void {
  const title = document.createElement("h2");
  title.textContent = `Briefing of ${shownTime.format(new Date(briefing.createdAt))}`;
  offerSelection(shown, `${title.textContent} (${briefing.title})`, {
    kind: "briefing",
    id: briefing.id,
  });
  const details = document.createElement("p");
  details.className = "item-meta";
  details.textContent = `${briefing.title} · ${String(briefing.itemCount)} Items · cost $${briefing.costUsd}`;
  const sections = briefing.sections.map((section, index) => {
    const headingId = `briefing-${String(briefing.id)}-folder-${String(index)}`;
    const heading = document.createElement("h3");
    heading.id = headingId;
    heading.textContent = section.folder.name;
    const points = document.createElement("ul");
    points.className = "briefing-points";
    points.append(
      ...section.points.map((point) => pointCard(point, onOpenItem)),
    );
    const shownSection = document.createElement("section");
    shownSection.className = "briefing-section";
    shownSection.setAttribute("aria-labelledby", headingId);
    shownSection.append(heading, points);
    return shownSection;
  });
  shown.replaceChildren(title, details);
  if (sections.length > 1) shown.append(folderStrip(sections));
  shown.append(...sections);
}

// The Folder buttons that jump to each section; a long Briefing has six Folders of eight points.
function folderStrip(sections: HTMLElement[]): HTMLElement {
  const strip = document.createElement("nav");
  strip.className = "briefing-folders";
  strip.setAttribute("aria-label", "Folders");
  for (const section of sections) {
    const jump = document.createElement("button");
    jump.type = "button";
    jump.textContent = section.querySelector("h3")?.textContent ?? "";
    jump.addEventListener("click", () => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    strip.append(jump);
  }
  return strip;
}

function pointCard(
  point: BriefingPoint,
  onOpenItem: (itemId: number) => void,
): HTMLLIElement {
  const text = document.createElement("p");
  const split = splitLeadSentence(point.text);
  if (split === null) {
    text.textContent = point.text;
  } else {
    // The bold lead is the point's headline; it opens the point's first Item in the app.
    const lead = document.createElement("strong");
    const first = point.items[0];
    if (first === undefined) {
      lead.textContent = split.lead;
    } else {
      const link = document.createElement("a");
      link.className = "briefing-lead";
      link.href = `#items/${String(first.id)}`;
      link.textContent = split.lead;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        onOpenItem(first.id);
      });
      lead.append(link);
    }
    text.append(lead, ` ${split.rest}`);
  }
  const card = document.createElement("li");
  card.append(text, sourceLinks(point.items, onOpenItem));
  return card;
}

function sourceLinks(
  items: BriefingItemLink[],
  onOpenItem: (itemId: number) => void,
): HTMLElement {
  const sources = document.createElement("div");
  sources.className = "briefing-sources";
  const links = items.map((item) => itemLink(item, onOpenItem));
  sources.append(...links.slice(0, SHOWN_SOURCES));
  const hidden = links.slice(SHOWN_SOURCES);
  if (hidden.length > 0) {
    const more = document.createElement("button");
    more.type = "button";
    more.textContent = `+${String(hidden.length)} more`;
    more.addEventListener("click", () => {
      more.replaceWith(...hidden);
    });
    sources.append(more);
  }
  return sources;
}

function itemLink(
  item: BriefingItemLink,
  onOpenItem: (itemId: number) => void,
): HTMLAnchorElement {
  const link = document.createElement("a");
  // A real link, so it can be focused and read out; the Item view opens in the app.
  link.href = `#items/${String(item.id)}`;
  link.textContent = item.source;
  link.title = item.title;
  link.setAttribute("aria-label", `${item.source}: ${item.title}`);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenItem(item.id);
  });
  return link;
}
