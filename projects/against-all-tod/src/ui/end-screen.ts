/** "Score 4 · Best Score 6", or a new best called out as such. */
export function endScreenScores(score: number, bestBefore: number): string {
  if (score > bestBefore) {
    return `Score ${String(score)} · a new best Score!`;
  }
  return `Score ${String(score)} · Best Score ${String(bestBefore)}`;
}

/** The end-of-Run screen over the Board: the Score, the best Score and one click to a new Run. */
export class EndScreen {
  private readonly scores: HTMLElement;

  constructor(
    private readonly host: HTMLElement,
    onNewRun: () => void,
  ) {
    const doc = host.ownerDocument;
    const heading = doc.createElement("h1");
    heading.textContent = "Out of Lives: the Run is over";
    this.scores = doc.createElement("p");
    const newRun = doc.createElement("button");
    newRun.type = "button";
    newRun.textContent = "New Run";
    newRun.addEventListener("click", onNewRun);
    host.replaceChildren(heading, this.scores, newRun);
    host.hidden = true;
  }

  /** `bestBefore` is the best Score before this Run, so a new best can be called out. */
  show(score: number, bestBefore: number): void {
    this.scores.textContent = endScreenScores(score, bestBefore);
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
