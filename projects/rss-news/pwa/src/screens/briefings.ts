import type { BriefingSummary } from "../api/briefings";
import { SignedOutError, type ApiClient } from "../api/client";
import { showBriefing } from "./briefing-view";
import { shownTime } from "./shown-time";

// The Briefings list: every saved Briefing newest first. Choosing one shows it here, with a
// button back to the list.
export async function renderBriefings(
  root: HTMLElement,
  api: ApiClient,
  onOpenItem: (itemId: number) => void,
): Promise<void> {
  const list = document.createElement("ul");
  list.setAttribute("aria-label", "Saved Briefings");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Briefings");
  root.replaceChildren(list, status);
  try {
    const briefings = await api.briefings();
    list.replaceChildren(
      ...briefings.map((briefing) =>
        briefingRow(briefing, () => void open(briefing.id)),
      ),
    );
    if (briefings.length === 0) {
      status.textContent = "No Briefings yet. Brief me on Home writes one.";
    }
  } catch (error) {
    if (error instanceof SignedOutError) return;
    status.textContent = `Couldn't load the Briefings: ${messageOf(error)}`;
  }

  async function open(briefingId: number): Promise<void> {
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to Briefings";
    back.addEventListener("click", () => {
      void renderBriefings(root, api, onOpenItem);
    });
    const shown = document.createElement("section");
    shown.setAttribute("aria-label", "Briefing");
    shown.textContent = "Loading the Briefing…";
    root.replaceChildren(back, shown);
    try {
      showBriefing(shown, await api.briefing(briefingId), onOpenItem);
    } catch (error) {
      if (error instanceof SignedOutError) return;
      shown.textContent = `Couldn't load the Briefing: ${messageOf(error)}`;
    }
  }
}

function briefingRow(
  briefing: BriefingSummary,
  onOpen: () => void,
): HTMLLIElement {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.href = `#briefings/${String(briefing.id)}`;
  link.textContent = `${shownTime.format(new Date(briefing.createdAt))}: ${briefing.title}`;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen();
  });
  const details = document.createElement("small");
  details.textContent = ` ${String(briefing.itemCount)} Items · cost $${briefing.costUsd}`;
  row.append(link, details);
  return row;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
