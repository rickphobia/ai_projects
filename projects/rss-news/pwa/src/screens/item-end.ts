import { SignedOutError, type ApiClient, type InboxItem } from "../api/client";
import { followItemGestures } from "./item-gestures";

export interface ItemRun {
  // The Items either side of this one in the list it was opened from; null at either end, or
  // when it wasn't opened from a list (an Alert, a Briefing link).
  previousId: number | null;
  nextId: number | null;
  // Shows another Item of the list in this one's place.
  onMove: (itemId: number) => void;
  // Back to where the Item was opened from, when there is no next Item.
  onBack: () => void;
}

// The end of an Item: scrolling on past it (or its button) marks the Item read and opens the next
// Item, or goes back when it was the last. A bar fills while the owner pulls. Swipes and the arrow
// keys move to the next or previous Item without marking anything.
export function itemEnd(
  item: InboxItem,
  api: ApiClient,
  run: ItemRun,
): HTMLElement {
  const end = document.createElement("footer");
  end.className = "item-end";
  const bar = document.createElement("div");
  bar.className = "item-end-bar";
  bar.setAttribute("aria-hidden", "true");
  const hint = document.createElement("p");
  hint.className = "item-end-hint";
  hint.textContent =
    run.nextId === null
      ? "Keep scrolling to mark it read and go back"
      : "Keep scrolling to mark it read and open the next Item";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "primary";
  done.textContent =
    run.nextId === null ? "Mark read and go back" : "Mark read: next Item ↓";
  const actions = document.createElement("div");
  actions.className = "toolbar";
  const previousId = run.previousId;
  if (previousId !== null) {
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹ Previous Item";
    previous.addEventListener("click", () => {
      run.onMove(previousId);
    });
    actions.append(previous);
  }
  actions.append(done);
  // Only there while it has something to say, so it doesn't stand beside Reader view's own.
  const problem = document.createElement("p");
  end.append(bar, hint, actions);

  let finishing = false;
  const finish = async (): Promise<void> => {
    if (finishing) return;
    finishing = true;
    done.disabled = true;
    problem.remove();
    try {
      if (!item.read) await api.markRead(item.id);
    } catch (error) {
      finishing = false;
      done.disabled = false;
      if (error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      problem.setAttribute("role", "alert");
      problem.textContent = `Couldn't mark it read: ${detail}`;
      end.append(problem);
      return;
    }
    if (run.nextId === null) run.onBack();
    else run.onMove(run.nextId);
  };
  done.addEventListener("click", () => void finish());

  followItemGestures(end, {
    onNext: () => {
      if (run.nextId !== null) run.onMove(run.nextId);
    },
    onPrevious: () => {
      if (previousId !== null) run.onMove(previousId);
    },
    onPull: (progress) => {
      end.style.setProperty("--pull", String(progress));
      end.classList.toggle("pulled", progress >= 1);
    },
    onPulledPastEnd: () => void finish(),
  });
  return end;
}

// Where an Item sits in the list it was opened from.
export function neighbours(
  itemId: number,
  listedIds: readonly number[],
): Pick<ItemRun, "previousId" | "nextId"> {
  const at = listedIds.indexOf(itemId);
  if (at === -1) return { previousId: null, nextId: null };
  return {
    previousId: listedIds[at - 1] ?? null,
    nextId: listedIds[at + 1] ?? null,
  };
}
