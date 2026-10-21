import { newUnlocks, nextUnlock } from "../progress/progress";

/** "Score 4 · Best Score 6", or a new best called out as such. */
export function endScreenScores(score: number, bestBefore: number): string {
  if (score > bestBefore) {
    return `Score ${String(score)} · a new best Score!`;
  }
  return `Score ${String(score)} · Best Score ${String(bestBefore)}`;
}

/**
 * What this Run Unlocked, if anything, then the next Unlock and the best Score it needs:
 * "Unlocked: Sapper. Next: Bouncer at best Score 10".
 */
export function endScreenUnlocks(score: number, bestBefore: number): string {
  const best = Math.max(score, bestBefore);
  const earned = newUnlocks(bestBefore, best).map(({ name }) => name);
  const next = nextUnlock(best);
  return [
    ...(earned.length === 0 ? [] : [`Unlocked: ${earned.join(", ")}.`]),
    next === null
      ? "Everything is Unlocked."
      : `Next: ${next.name} at best Score ${String(next.score)}.`,
  ].join(" ");
}

/**
 * The end-of-Run screen over the Board: the Score, the best Score, the Unlocks and one click to a
 * new Run.
 */
export class EndScreen {
  private readonly scores: HTMLElement;
  private readonly unlocks: HTMLElement;

  constructor(
    private readonly host: HTMLElement,
    onNewRun: () => void,
  ) {
    const doc = host.ownerDocument;
    const heading = doc.createElement("h1");
    heading.className = "ribbon";
    heading.textContent = "Out of Lives: the Run is over";
    this.scores = doc.createElement("p");
    this.unlocks = doc.createElement("p");
    const newRun = doc.createElement("button");
    newRun.type = "button";
    newRun.className = "btn";
    newRun.textContent = "New Run";
    newRun.addEventListener("click", onNewRun);
    const card = doc.createElement("div");
    card.className = "card end-card";
    card.append(heading, this.scores, this.unlocks, newRun);
    host.replaceChildren(card);
    host.hidden = true;
  }

  /** `bestBefore` is the best Score before this Run, so a new best can be called out. */
  show(score: number, bestBefore: number): void {
    this.scores.textContent = endScreenScores(score, bestBefore);
    this.unlocks.textContent = endScreenUnlocks(score, bestBefore);
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
