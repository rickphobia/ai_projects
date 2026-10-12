import type {
  Briefing,
  BriefingEstimate,
  BriefingProgress,
} from "../api/briefings";
import { SignedOutError, type ApiClient } from "../api/client";
import { shownTime } from "./shown-time";

// The home screen: the latest Briefing, and Brief me with its estimated cost. Pressing it
// again the same day shows the saved Briefing with a Regenerate button.
export async function renderHome(
  root: HTMLElement,
  api: ApiClient,
  onOpenItem: (itemId: number) => void,
): Promise<void> {
  const briefMe = button("Brief me");
  // Waits for the estimate, so the owner never presses without seeing the cost.
  briefMe.disabled = true;
  const regenerate = button("Regenerate");
  regenerate.hidden = true;
  const progress = document.createElement("p");
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-label", "Briefing progress");
  const failure = document.createElement("p");
  failure.setAttribute("role", "alert");
  const shown = document.createElement("section");
  shown.setAttribute("aria-label", "Briefing");
  root.replaceChildren(briefMe, regenerate, progress, failure, shown);

  let estimate: BriefingEstimate | null = null;
  const write = async (again: boolean): Promise<void> => {
    briefMe.disabled = true;
    regenerate.disabled = true;
    failure.textContent = "";
    progress.textContent = "Starting the Briefing…";
    try {
      const written = await api.writeBriefing(again, (step) => {
        progress.textContent = progressText(step);
      });
      showBriefing(shown, written.briefing, onOpenItem);
      regenerate.hidden = !written.reused;
      progress.textContent = written.reused
        ? "This is today's Briefing, already written. Regenerate writes a new one."
        : "";
    } catch (error) {
      if (error instanceof SignedOutError) return;
      progress.textContent = "";
      failure.textContent = messageOf(error);
    } finally {
      briefMe.disabled = estimate === null || estimate.itemCount === 0;
      regenerate.disabled = false;
    }
  };
  briefMe.addEventListener("click", () => void write(false));
  regenerate.addEventListener("click", () => void write(true));

  const [latest, estimated] = await Promise.allSettled([
    api.latestBriefing(),
    api.briefingEstimate(),
  ]);
  if (isSignedOut(latest) || isSignedOut(estimated)) return;
  if (latest.status === "fulfilled") {
    if (latest.value === null) {
      shown.textContent =
        "No Briefing yet. Press Brief me to write the first one.";
    } else {
      showBriefing(shown, latest.value, onOpenItem);
    }
  } else {
    shown.textContent = `Couldn't load the latest Briefing: ${messageOf(latest.reason)}`;
  }
  if (estimated.status === "fulfilled") {
    estimate = estimated.value;
    regenerate.textContent = `Regenerate (about $${estimate.estimatedCostUsd})`;
    if (estimate.itemCount === 0) {
      progress.textContent = "Nothing arrived in the last 24 hours to brief.";
    } else {
      briefMe.textContent = `Brief me: last 24 hours (about $${estimate.estimatedCostUsd})`;
      briefMe.disabled = false;
    }
  } else {
    failure.textContent = `Couldn't work out what a Briefing would cost: ${messageOf(estimated.reason)}`;
  }
}

function showBriefing(
  shown: HTMLElement,
  briefing: Briefing,
  onOpenItem: (itemId: number) => void,
): void {
  const title = document.createElement("h2");
  title.textContent = `Briefing of ${shownTime.format(new Date(briefing.createdAt))}`;
  const details = document.createElement("p");
  details.textContent = `All Sources, last 24 hours · ${String(briefing.itemCount)} Items · cost $${briefing.costUsd}`;
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

function progressText(step: BriefingProgress): string {
  const of = `(${String(step.section)} of ${String(step.sections)})`;
  return step.step === "reading"
    ? `Reading the top ${step.folder} articles ${of}…`
    : `Writing ${step.folder} ${of}…`;
}

function button(text: string): HTMLButtonElement {
  const made = document.createElement("button");
  made.type = "button";
  made.textContent = text;
  return made;
}

function isSignedOut(result: PromiseSettledResult<unknown>): boolean {
  return (
    result.status === "rejected" && result.reason instanceof SignedOutError
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
