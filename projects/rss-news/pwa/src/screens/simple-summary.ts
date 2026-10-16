import { SignedOutError, type ApiClient } from "../api/client";
import type { SimpleSummary } from "../api/simple-summaries";

// The Item's Summarise button and the region its Simple summary appears in. Each press asks
// the server again (nothing is saved), so once a summary shows, the button hides.
export function simpleSummaryButton(
  itemId: number,
  api: ApiClient,
  region: HTMLElement,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Summarise";
  region.setAttribute("aria-label", "Simple summary");
  region.className = "simple-summary";
  region.hidden = true;
  const summarise = async (): Promise<void> => {
    button.disabled = true;
    region.hidden = false;
    region.setAttribute("aria-busy", "true");
    region.replaceChildren(paragraph("Summarising the whole Item…"));
    try {
      region.replaceChildren(...summaryParts(await api.simpleSummary(itemId)));
      button.hidden = true;
    } catch (error) {
      button.disabled = false;
      if (error instanceof SignedOutError) return;
      const problem = paragraph(`Couldn't summarise it: ${messageOf(error)}`);
      problem.setAttribute("role", "alert");
      region.replaceChildren(problem);
    } finally {
      region.removeAttribute("aria-busy");
    }
  };
  button.addEventListener("click", () => void summarise());
  return button;
}

function summaryParts(summary: SimpleSummary): HTMLElement[] {
  const gist = paragraph(summary.gist);
  gist.className = "simple-summary-gist";
  const points = document.createElement("ul");
  for (const text of summary.points) {
    const point = document.createElement("li");
    point.textContent = text;
    points.append(point);
  }
  const parts: HTMLElement[] = [gist, points];
  if (summary.fromPreview) {
    const note = paragraph(
      "The full article couldn't be loaded, so this only covers the feed's preview.",
    );
    note.className = "reader-note";
    parts.push(note);
  }
  return parts;
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.textContent = text;
  return element;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
