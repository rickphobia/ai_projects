import type {
  BriefingEstimate,
  BriefingProgress,
  BriefingRequest,
  BriefingWindow,
  WrittenBriefing,
} from "../api/briefings";
import { RefusedError, SignedOutError, type ApiClient } from "../api/client";
import { storedPendingJobs, type PendingJobs } from "../pwa/pending-jobs";

const ALL_SOURCES = "";
const WINDOW_TEXT: Record<BriefingWindow, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

// Brief me, as one compact bar at the top of the Inbox: Brief [All Sources or a Folder] over
// [a window] [Brief me (about $X)], with its progress and errors under it. A finished Briefing
// isn't shown here (the Briefings screen shows them); the bar links to it. Pressing it again the
// same day links today's saved Briefing with a Regenerate button. Given `pickedItemIds` ("Brief
// these" in the Inbox or under a Chat answer), it offers a Briefing of exactly those Items
// instead. Given `briefNow` (the Brief me (24h) shortcut), it presses Brief me for the default
// scope as soon as the estimate is in. A Briefing still being written when the page was left
// (pending-jobs.ts) shows its progress again, then its link.
export async function renderBriefMe(
  root: HTMLElement,
  api: ApiClient,
  pickedItemIds?: number[],
  briefNow = false,
  pending: PendingJobs = storedPendingJobs(),
): Promise<void> {
  const picked = pickedItemIds !== undefined && pickedItemIds.length > 0;
  const briefMe = button(picked ? "Brief these" : "Brief me");
  briefMe.className = "primary";
  // Waits for the estimate, so the owner never presses without seeing the cost.
  briefMe.disabled = true;
  const scopeSelect = document.createElement("select");
  scopeSelect.append(new Option("All Sources", ALL_SOURCES));
  const windowSelect = document.createElement("select");
  for (const [value, text] of Object.entries(WINDOW_TEXT)) {
    windowSelect.append(new Option(capitalised(text), value));
  }
  const bar = document.createElement("div");
  bar.className = "brief-me-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Brief me");
  if (!picked) {
    bar.append(labelled("Brief", scopeSelect), labelled("over", windowSelect));
  }
  bar.append(briefMe);
  const progress = document.createElement("p");
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-label", "Briefing progress");
  const failure = document.createElement("p");
  failure.setAttribute("role", "alert");
  const openBriefing = document.createElement("a");
  openBriefing.textContent = "Open the Briefing";
  const regenerate = button("Regenerate");
  regenerate.hidden = true;
  const written = document.createElement("p");
  written.className = "toolbar";
  written.hidden = true;
  written.append(openBriefing, regenerate);
  root.replaceChildren(bar, progress, failure, written);

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
    // The bar's selects already say the scope; only picked Items need it spelled out.
    briefMe.textContent = picked ? `Brief these: ${scopeText()}` : "Brief me";
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

  const showProgress = (step: BriefingProgress): void => {
    progress.textContent = progressText(step);
  };
  const write = (again: boolean): Promise<void> =>
    finish("Starting the Briefing…", () =>
      api.writeBriefing(request(), again, showProgress, (jobId) => {
        pending.setBriefing(jobId);
      }),
    );
  // The server writes on when the page closes; coming back follows the job it remembered.
  const followPending = (jobId: string): Promise<void> =>
    finish("Still writing your Briefing…", () =>
      api.followBriefing(jobId, showProgress),
    );

  const finish = async (
    starting: string,
    briefing: () => Promise<WrittenBriefing>,
  ): Promise<void> => {
    writing = true;
    briefMe.disabled = true;
    regenerate.disabled = true;
    failure.textContent = "";
    progress.textContent = starting;
    try {
      const answer = await briefing();
      pending.setBriefing(null);
      openBriefing.href = `#briefings/${String(answer.briefing.id)}`;
      written.hidden = false;
      regenerate.hidden = !answer.reused;
      progress.textContent = answer.reused
        ? "This is today's Briefing, already written. Regenerate writes a new one."
        : "";
    } catch (error) {
      if (error instanceof SignedOutError) return;
      // Failed, or lost to a server restart: either way it isn't running any more. A dropped
      // connection leaves the job running, so it stays remembered for coming back.
      if (error instanceof RefusedError) pending.setBriefing(null);
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

  await Promise.allSettled([
    // After the estimate, which would otherwise clear what following shows.
    refreshEstimate().then(() => {
      const pendingJob = pending.briefing();
      if (pendingJob !== null) void followPending(pendingJob);
      else if (briefNow && !briefMe.disabled) void write(false);
    }),
    picked ? Promise.resolve() : fillFolders(api, scopeSelect),
  ]);
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface BriefMeBar {
  bar: HTMLElement;
  // Draws Brief me again, for picked Items or pressing itself when asked.
  show: (pickedItemIds?: number[], briefNow?: boolean) => Promise<void>;
}

// The Brief me bar at the top of the Inbox, always showing once show() has drawn it.
export function briefMeBar(api: ApiClient): BriefMeBar {
  const bar = document.createElement("div");
  bar.className = "brief-me";
  const show = (pickedItemIds?: number[], briefNow = false): Promise<void> =>
    renderBriefMe(bar, api, pickedItemIds, briefNow);
  return { bar, show };
}
