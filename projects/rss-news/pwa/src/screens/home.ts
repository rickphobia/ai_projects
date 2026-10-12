import type {
  BriefingEstimate,
  BriefingProgress,
  BriefingRequest,
  BriefingWindow,
} from "../api/briefings";
import { SignedOutError, type ApiClient } from "../api/client";
import { showBriefing } from "./briefing-view";

const ALL_SOURCES = "";
const WINDOW_TEXT: Record<BriefingWindow, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

// The home screen: the latest Briefing, and Brief me with a scope (all Sources or one
// Folder), a window and the estimated cost. Pressing it again the same day shows the saved
// Briefing with a Regenerate button. Given `pickedItemIds` (from the Inbox's "Brief these"),
// it offers a Briefing of exactly those Items instead.
export async function renderHome(
  root: HTMLElement,
  api: ApiClient,
  onOpenItem: (itemId: number) => void,
  pickedItemIds?: number[],
): Promise<void> {
  const picked = pickedItemIds !== undefined && pickedItemIds.length > 0;
  const briefMe = button(picked ? "Brief these" : "Brief me");
  // Waits for the estimate, so the owner never presses without seeing the cost.
  briefMe.disabled = true;
  const scopeSelect = document.createElement("select");
  scopeSelect.append(new Option("All Sources", ALL_SOURCES));
  const windowSelect = document.createElement("select");
  for (const [value, text] of Object.entries(WINDOW_TEXT)) {
    windowSelect.append(new Option(capitalised(text), value));
  }
  const controls = document.createElement("div");
  controls.className = "toolbar";
  controls.hidden = picked;
  controls.append(
    labelled("Brief", scopeSelect),
    labelled("Over", windowSelect),
  );
  briefMe.className = "primary";
  const regenerate = button("Regenerate");
  regenerate.hidden = true;
  const progress = document.createElement("p");
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-label", "Briefing progress");
  const failure = document.createElement("p");
  failure.setAttribute("role", "alert");
  const shown = document.createElement("section");
  shown.setAttribute("aria-label", "Briefing");
  shown.className = "briefing";
  const actions = document.createElement("div");
  actions.className = "toolbar";
  actions.append(briefMe, regenerate);
  const column = document.createElement("div");
  column.className = "reading";
  column.append(controls, actions, progress, failure, shown);
  root.replaceChildren(column);

  const request = (): BriefingRequest =>
    picked
      ? { itemIds: pickedItemIds }
      : {
          window: windowSelect.value as BriefingWindow,
          ...(scopeSelect.value === ALL_SOURCES
            ? {}
            : { folderId: Number(scopeSelect.value) }),
        };
  const scopeText = (): string => {
    if (picked) return `${String(pickedItemIds.length)} picked Items`;
    const window = WINDOW_TEXT[windowSelect.value as BriefingWindow];
    const folder = scopeSelect.selectedOptions[0];
    return scopeSelect.value === ALL_SOURCES || folder === undefined
      ? window
      : `${folder.text}, ${window}`;
  };

  let estimate: BriefingEstimate | null = null;
  let writing = false;
  // Each estimate gets a number; one that arrives after the scope changed again is dropped.
  let latestEstimate = 0;
  const refreshEstimate = async (): Promise<void> => {
    latestEstimate += 1;
    const thisEstimate = latestEstimate;
    estimate = null;
    briefMe.disabled = true;
    regenerate.hidden = true;
    briefMe.textContent = `${picked ? "Brief these" : "Brief me"}: ${scopeText()}`;
    try {
      const answer = await api.briefingEstimate(request());
      if (thisEstimate !== latestEstimate) return;
      estimate = answer;
      failure.textContent = "";
      regenerate.textContent = `Regenerate (about $${answer.estimatedCostUsd})`;
      if (answer.itemCount === 0) {
        progress.textContent = picked
          ? "None of the picked Items exist any more."
          : `Nothing to brief in the ${scopeText()}.`;
      } else {
        if (!writing) progress.textContent = "";
        briefMe.textContent += ` (about $${answer.estimatedCostUsd})`;
        briefMe.disabled = writing;
      }
    } catch (error) {
      if (thisEstimate !== latestEstimate || error instanceof SignedOutError) {
        return;
      }
      failure.textContent = `Couldn't work out what a Briefing would cost: ${messageOf(error)}`;
    }
  };

  const write = async (again: boolean): Promise<void> => {
    writing = true;
    briefMe.disabled = true;
    regenerate.disabled = true;
    failure.textContent = "";
    progress.textContent = "Starting the Briefing…";
    try {
      const written = await api.writeBriefing(request(), again, (step) => {
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
      writing = false;
      briefMe.disabled = estimate === null || estimate.itemCount === 0;
      regenerate.disabled = false;
    }
  };
  briefMe.addEventListener("click", () => void write(false));
  regenerate.addEventListener("click", () => void write(true));
  for (const select of [scopeSelect, windowSelect]) {
    select.addEventListener("change", () => void refreshEstimate());
  }

  const [latest] = await Promise.allSettled([
    api.latestBriefing(),
    refreshEstimate(),
    picked ? Promise.resolve() : fillFolders(api, scopeSelect),
  ]);
  if (isSignedOut(latest)) return;
  // A picked Briefing isn't shown until it is written; the latest one would confuse.
  if (picked) return;
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
}

async function fillFolders(
  api: ApiClient,
  scopeSelect: HTMLSelectElement,
): Promise<void> {
  try {
    const folders = await api.folders();
    scopeSelect.append(
      ...folders.map((folder) => new Option(folder.name, String(folder.id))),
    );
  } catch (error) {
    if (error instanceof SignedOutError) return;
    // All Sources still works without the Folders.
    scopeSelect.disabled = true;
    scopeSelect.title = `Couldn't load the Folders: ${messageOf(error)}`;
  }
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

function labelled(text: string, select: HTMLSelectElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = text;
  label.append(select);
  return label;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isSignedOut(result: PromiseSettledResult<unknown>): boolean {
  return (
    result.status === "rejected" && result.reason instanceof SignedOutError
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
