import type { BattleOutcome } from "../battle/battle";
import { WATCH_SPEEDS, type WatchSpeed } from "../battle/watch-clock";
import { PIECES, type PieceId } from "../catalog/pieces";
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

const OUTCOME_MESSAGES: Readonly<Record<BattleOutcome["reason"], string>> = {
  "goal-destroyed": "Attack wins: the Goal broke.",
  "army-gone": "Defense wins: the whole Army is gone.",
  "time-up": "Defense wins: the Army ran out of time.",
};

export function refusalMessage(refusal: PlacementRefusal): string {
  return REFUSAL_MESSAGES[refusal];
}

export function outcomeMessage(outcome: BattleOutcome): string {
  return OUTCOME_MESSAGES[outcome.reason];
}

/** "Goal 85/100 · 0:23", for the line under the heading during a battle. */
export function battleStatus(
  goalHealth: number,
  maxHealth: number,
  seconds: number,
): string {
  const whole = Math.floor(seconds);
  const clock = `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, "0")}`;
  return `Goal ${String(Math.ceil(goalHealth))}/${String(maxHealth)} · ${clock}`;
}

export interface HudHandlers {
  readonly onChoosePiece: (pieceId: PieceId) => void;
  readonly onFight: () => void;
  readonly onWatchSpeed: (speed: WatchSpeed) => void;
  readonly onBuildAgain: () => void;
}

/** The DOM band over the Board: the turn, its buttons, what to do, and why a placement was refused. */
export class Hud {
  private readonly doc: Document;
  private readonly heading: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly message: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    host: HTMLElement,
    private readonly buildPieces: readonly PieceId[],
    private readonly handlers: HudHandlers,
  ) {
    this.doc = host.ownerDocument;
    const top = this.doc.createElement("div");
    top.className = "hud-top";
    this.heading = this.doc.createElement("h1");
    this.controls = this.doc.createElement("div");
    this.controls.className = "hud-controls";
    top.append(this.heading, this.controls);
    this.hint = this.doc.createElement("p");
    this.message = this.doc.createElement("p");
    this.message.className = "hud-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    host.replaceChildren(top, this.hint, this.message);
  }

  showBuilding(chosen: PieceId): void {
    this.heading.textContent = "Defense turn";
    const pieceButtons = this.buildPieces.map((pieceId) =>
      this.button(PIECES[pieceId].name, pieceId === chosen, () => {
        this.handlers.onChoosePiece(pieceId);
      }),
    );
    const fight = this.button("Fight", null, this.handlers.onFight);
    fight.classList.add("hud-fight");
    this.controls.replaceChildren(...pieceButtons, fight);
    this.hint.textContent = `Tap a tile to place a ${PIECES[chosen].name}, or a Piece to see what it does. Drag to pan; pinch or scroll to zoom.`;
  }

  showBattle(speed: WatchSpeed): void {
    this.heading.textContent = "Defense turn: fight";
    this.controls.replaceChildren(
      ...WATCH_SPEEDS.map((option) =>
        this.button(`${String(option)}x`, option === speed, () => {
          this.handlers.onWatchSpeed(option);
        }),
      ),
    );
  }

  showBattleStatus(
    goalHealth: number,
    maxHealth: number,
    seconds: number,
  ): void {
    this.hint.textContent = battleStatus(goalHealth, maxHealth, seconds);
  }

  showOutcome(outcome: BattleOutcome): void {
    this.heading.textContent = outcomeMessage(outcome);
    this.controls.replaceChildren(
      this.button("Build again", null, this.handlers.onBuildAgain),
    );
  }

  showRefusal(refusal: PlacementRefusal): void {
    this.message.textContent = refusalMessage(refusal);
    this.message.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.message.hidden = true;
    }, MESSAGE_MS);
  }

  /** `pressed` is null for a plain button, true or false for one of a set of choices. */
  private button(
    label: string,
    pressed: boolean | null,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", onClick);
    return button;
  }
}
