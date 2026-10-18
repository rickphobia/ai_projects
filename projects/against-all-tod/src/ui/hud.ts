import type { PlacementRefusal } from "../maze/maze";

/** How long a refusal stays on screen. */
const MESSAGE_MS = 3000;

const REFUSAL_MESSAGES: Readonly<Record<PlacementRefusal, string>> = {
  "off-board": "That's off the Board.",
  "spawn-line": "You can't build on the Spawn line: the Army enters there.",
  goal: "You can't build on the Goal.",
  "tile-taken": "That tile already has a Piece.",
  "seals-goal":
    "That would seal the Goal off. Dudes must always have a route to it.",
};

export function refusalMessage(refusal: PlacementRefusal): string {
  return REFUSAL_MESSAGES[refusal];
}

/** The DOM overlay over the Board: which turn it is, what to do, and why a placement was refused. */
export class Hud {
  private readonly message: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(host: HTMLElement, turn: string, instruction: string) {
    const doc = host.ownerDocument;
    const heading = doc.createElement("h1");
    heading.textContent = turn;
    const hint = doc.createElement("p");
    hint.textContent = instruction;
    this.message = doc.createElement("p");
    this.message.className = "hud-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    host.replaceChildren(heading, hint, this.message);
  }

  showRefusal(refusal: PlacementRefusal): void {
    this.message.textContent = refusalMessage(refusal);
    this.message.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.message.hidden = true;
    }, MESSAGE_MS);
  }
}
