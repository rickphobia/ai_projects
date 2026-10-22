import { RefusedError, SignedOutError, type ApiClient } from "../api/client";
import type { SimpleSummary } from "../api/simple-summaries";
import { storedPendingJobs, type PendingJobs } from "../pwa/pending-jobs";

// The Item's Summarise button and the region its Simple summary appears in. The server saves the
// summary for the Item, so opening it shows the saved one with Summarise again, which pays for a
// new one. A summary still being written when the page was left (pending-jobs.ts) is followed
// again; the server keeps writing it either way.
export function simpleSummaryButton(
  itemId: number,
  api: ApiClient,
  region: HTMLElement,
  pending: PendingJobs = storedPendingJobs(),
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Summarise";
  region.setAttribute("aria-label", "Simple summary");
  region.className = "simple-summary";
  region.hidden = true;
  // Set once the owner presses, so a slower look-up of the saved summary doesn't draw over it.
  let pressed = false;

  const show = (summary: SimpleSummary): void => {
    region.hidden = false;
    region.replaceChildren(...summaryParts(summary));
    button.textContent = "Summarise again";
  };
  const finish = async (
    waiting: string,
    summary: () => Promise<SimpleSummary>,
  ): Promise<void> => {
    button.disabled = true;
    region.hidden = false;
    region.setAttribute("aria-busy", "true");
    region.replaceChildren(paragraph(waiting));
    try {
      const written = await summary();
      pending.setSummary(itemId, null);
      show(written);
    } catch (error) {
      if (error instanceof SignedOutError) return;
      // Failed, or lost to a server restart: either way it isn't running any more. A dropped
      // connection leaves the job running, so it stays remembered for coming back.
      if (error instanceof RefusedError) pending.setSummary(itemId, null);
      const problem = paragraph(`Couldn't summarise it: ${messageOf(error)}`);
      problem.setAttribute("role", "alert");
      region.replaceChildren(problem);
    } finally {
      button.disabled = false;
      region.removeAttribute("aria-busy");
    }
  };
  const summarise = (): Promise<void> => {
    pressed = true;
    return finish("Summarising the whole Item…", () =>
      api.simpleSummary(itemId, (jobId) => {
        pending.setSummary(itemId, jobId);
      }),
    );
  };
  const showSaved = async (): Promise<void> => {
    const waiting = pending.summary(itemId);
    if (waiting !== null) {
      pressed = true;
      await finish("Summarising…", () => api.followSimpleSummary(waiting));
      return;
    }
    try {
      const saved = await api.savedSimpleSummary(itemId);
      if (saved !== null && !pressed) show(saved);
    } catch (error) {
      if (error instanceof SignedOutError) return;
      // Summarise still works; only the saved summary is missing.
      button.title = `Couldn't load the saved summary: ${messageOf(error)}`;
    }
  };

  button.addEventListener("click", () => void summarise());
  void showSaved();
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
