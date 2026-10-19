import type { BattleOutcome, Side } from "../battle/battle";
import { WATCH_SPEEDS, type WatchSpeed } from "../battle/watch-clock";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import type { RunRefusal, RunStatus } from "../run/run";
import {
  attackItems,
  defenseItems,
  itemLabel,
  type ShopItem,
  type ShopStock,
} from "./shop";

/** How long a refusal stays on screen. */
const MESSAGE_MS = 3000;

const REFUSAL_MESSAGES: Readonly<Record<RunRefusal, string>> = {
  "off-board": "That's off the Board.",
  "spawn-line": "You can't build on the Spawn line: the Army enters there.",
  goal: "You can't build on the Goal.",
  "tile-taken": "That tile is already taken.",
  "seals-goal":
    "That would seal the Goal off. Dudes must always have a route to it.",
  "wrong-phase": "Not now: wait for the battle to end.",
  "wrong-side": "That belongs to the other side's turn.",
  "not-enough-gold":
    "Not enough gold. Each side pays from its own wallet; press Fight when you're done.",
  "not-spawn-line": "Squads go on the Spawn line, the Board's left edge.",
  "no-crate": "This Round's crate is already taken from.",
  "slider-end": "That slider can't go any further that way.",
};

const OUTCOME_MESSAGES: Readonly<Record<BattleOutcome["reason"], string>> = {
  "goal-destroyed": "Attack wins: the Goal broke.",
  "army-gone": "Defense wins: the whole Army is gone.",
  "time-up": "Defense wins: the Army ran out of time.",
};

const SIDE_NAMES: Readonly<Record<Side, string>> = {
  defense: "Defense turn",
  attack: "Attack turn",
};

export function refusalMessage(refusal: RunRefusal): string {
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

/** "Round 3 · Defense turn · Lives 2 · Score 2 · Defense gold 50 · Attack gold 40". */
export function runStatus(status: RunStatus): string {
  return [
    `Round ${String(status.round)}`,
    SIDE_NAMES[status.side],
    `Lives ${String(status.lives)}`,
    `Score ${String(status.score)}`,
    `Defense gold ${String(status.wallets.defense)}`,
    `Attack gold ${String(status.wallets.attack)}`,
  ].join(" · ");
}

/** The line under the heading after a battle: what the result means for the Run. */
export function roundOverMessage(won: boolean, livesLeft: number): string {
  if (won) return "Round won. Next you switch sides.";
  const lives = livesLeft === 1 ? "1 Life" : `${String(livesLeft)} Lives`;
  return `Round lost: ${lives} left. The Board Rewinds to the start of the Round.`;
}

export interface HudHandlers {
  readonly onChoosePiece: (pieceId: PieceId) => void;
  readonly onChooseDudeKind: (dudeKind: DudeKindId) => void;
  readonly onFight: () => void;
  readonly onWatchSpeed: (speed: WatchSpeed) => void;
  readonly onContinue: () => void;
}

/** The DOM band over the Board: the Run's status, the turn, its buttons, what to do, and why an action was refused. */
export class Hud {
  private readonly doc: Document;
  private readonly status: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly message: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly host: HTMLElement,
    private readonly stock: ShopStock,
    private readonly handlers: HudHandlers,
  ) {
    this.doc = host.ownerDocument;
    const top = this.doc.createElement("div");
    top.className = "hud-top";
    this.status = this.doc.createElement("span");
    this.status.className = "hud-status";
    this.heading = this.doc.createElement("h1");
    this.controls = this.doc.createElement("div");
    this.controls.className = "hud-controls";
    top.append(this.status, this.heading, this.controls);
    this.hint = this.doc.createElement("p");
    this.message = this.doc.createElement("p");
    this.message.className = "hud-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    host.replaceChildren(top, this.hint, this.message);
  }

  showRunStatus(status: RunStatus): void {
    this.status.textContent = runStatus(status);
    // The heading and the chosen button wear the side's colour.
    this.host.setAttribute("data-side", status.side);
  }

  showDefenseBuilding(chosen: PieceId): void {
    this.heading.textContent = SIDE_NAMES.defense;
    this.showShop(
      defenseItems(this.stock),
      chosen,
      this.handlers.onChoosePiece,
    );
    this.hint.textContent = `Shop: pick a Piece, then tap a tile to buy it with Defense gold, or tap a Piece to see what it does. Placing a ${PIECES[chosen].name} now. Drag to pan; pinch or scroll to zoom.`;
  }

  showAttackBuilding(chosen: DudeKindId): void {
    this.heading.textContent = SIDE_NAMES.attack;
    this.showShop(
      attackItems(this.stock),
      chosen,
      this.handlers.onChooseDudeKind,
    );
    this.hint.textContent = `Shop: pick a Squad, then tap a Spawn line tile on the left edge to buy it with Attack gold. Adding ${DUDE_KINDS[chosen].name}s now. The whole Army attacks your own Maze.`;
  }

  showBattle(side: Side, speed: WatchSpeed): void {
    this.heading.textContent = `${SIDE_NAMES[side]}: fight`;
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

  /** The battle's winner and what it means for the Run. Not shown when the Run is over: the end screen is. */
  showRoundOver(outcome: BattleOutcome, won: boolean, livesLeft: number): void {
    this.heading.textContent = outcomeMessage(outcome);
    this.hint.textContent = roundOverMessage(won, livesLeft);
    const next = this.button("Continue", null, this.handlers.onContinue);
    next.classList.add("hud-fight");
    this.controls.replaceChildren(next);
  }

  showRefusal(refusal: RunRefusal): void {
    this.showMessage(refusalMessage(refusal));
  }

  /** A short message under the heading that fades after a few seconds. */
  showMessage(text: string): void {
    this.message.textContent = text;
    this.message.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.message.hidden = true;
    }, MESSAGE_MS);
  }

  /** One button per item the side's shop sells, with its price, the chosen one pressed, then Fight. */
  private showShop<Id extends string>(
    items: readonly ShopItem<Id>[],
    chosen: Id,
    onChoose: (id: Id) => void,
  ): void {
    const choiceButtons = items.map((item) =>
      this.button(itemLabel(item), item.id === chosen, () => {
        onChoose(item.id);
      }),
    );
    const fight = this.button("Fight", null, this.handlers.onFight);
    fight.classList.add("hud-fight");
    this.controls.replaceChildren(...choiceButtons, fight);
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
