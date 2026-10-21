import type { BattleOutcome, Side } from "../battle/battle";
import { WATCH_SPEEDS, type WatchSpeed } from "../battle/watch-clock";
import { BOSSES, type BossId } from "../catalog/bosses";
import { CURSES, type CurseId } from "../catalog/curses";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import { SLIDERS } from "../catalog/tricks";
import type { FreeItem, RunRefusal, RunStatus } from "../run/run";
import type { TakeBackAction } from "../run/take-back";
import { crateItemName } from "./crate";
import {
  attackItems,
  defenseItems,
  itemLabel,
  type ShopItem,
  type ShopStock,
} from "./shop";
import { roundHint } from "./hints";

/** How long a refusal stays on screen. */
const MESSAGE_MS = 3000;

const REFUSAL_MESSAGES: Readonly<Record<RunRefusal, string>> = {
  "off-board": "That's off the Board.",
  "spawn-zone":
    "You can't build in the Spawn zone: the Army stands there before it charges.",
  goal: "You can't build on the Goal.",
  "tile-taken": "That tile is already taken.",
  "seals-goal":
    "That would seal the Goal off. Dudes must always have a route to it.",
  "wrong-phase": "Not now: wait for the battle to end.",
  "wrong-side": "That belongs to the other side's turn.",
  "not-enough-gold":
    "Not enough gold. Each side pays from its own wallet; press Fight when you're done.",
  "not-spawn-zone":
    "Paint Dudes in the Spawn zone, the Board's 3 left columns.",
  "no-room": "No room there: each Dude keeps a little space around it.",
  "not-on-sale": "That Dude kind isn't on sale yet.",
  "no-dude": "There's no Dude there to erase.",
  "no-crate": "This Round's crate is already taken from.",
  "slider-end": "That slider can't go any further that way.",
  "nothing-to-undo": "That slider is already in the middle.",
  "no-piece": "There's no Piece there to destroy.",
  "undo-short":
    "Not enough picked: destroy more of your own to cover the Undo price.",
  "nothing-to-take-back":
    "Nothing to take back: this Round has no moves since its start, a crate reroll or an Undo.",
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

/**
 * "Round 3 · Defense turn · Lives 2 · Score 2 · Defense gold 50 · Attack gold 40", then the
 * Round's Curse and boss, if any.
 */
export function runStatus(status: RunStatus): string {
  return [
    `Round ${String(status.round)}`,
    SIDE_NAMES[status.side],
    `Lives ${String(status.lives)}`,
    `Score ${String(status.score)}`,
    `Defense gold ${String(status.wallets.defense)}`,
    `Attack gold ${String(status.wallets.attack)}`,
    ...(status.curse === null ? [] : [curseStatus(status.curse)]),
    ...(status.boss === null ? [] : [`Boss: ${BOSSES[status.boss].name}`]),
  ].join(" · ");
}

/** "Boss Round: The Landlord. Joins the Army…", announced as building starts. */
export function bossAnnouncement(boss: BossId): string {
  const { name, description } = BOSSES[boss];
  return `Boss Round: ${name}. ${description}`;
}

/** "Curse: Rust (towers fire 20% slower)", for the status line all Round. */
export function curseStatus(curse: CurseId): string {
  const { name, description } = CURSES[curse];
  const effect = description.charAt(0).toLowerCase() + description.slice(1);
  return `Curse: ${name} (${effect.replace(/\.$/, "")})`;
}

/** "Curse this Round: Rust, hurting the defense. Towers fire 20% slower.", announced as building starts. */
export function curseAnnouncement(curse: CurseId): string {
  const { name, hurts, description } = CURSES[curse];
  return `Curse this Round: ${name}, hurting the ${hurts}. ${description}`;
}

/** The line under the heading after a battle: what the result means for the Run. */
export function roundOverMessage(won: boolean, livesLeft: number): string {
  if (won) return "Round won. Next you switch sides.";
  const lives = livesLeft === 1 ? "1 Life" : `${String(livesLeft)} Lives`;
  return `Round lost: ${lives} left. The Board Rewinds to the start of the Round.`;
}

/** "Crate Wall", "Stroke of 12 Interns", "Eraser drag over 3 Dudes", "Brightness trick". */
export function takeBackName(action: TakeBackAction): string {
  const plural = (count: number, name: string) =>
    `${String(count)} ${count === 1 ? name : `${name}s`}`;
  switch (action.kind) {
    case "place-piece":
      return PIECES[action.pieceId].name;
    case "stroke":
      return `Stroke of ${plural(action.dudes, DUDE_KINDS[action.dudeKind].name)}`;
    case "eraser-drag":
      return `Eraser drag over ${plural(action.dudes, "Dude")}`;
    case "crate-pick":
      return `Crate pick: ${crateItemName(action.item)}`;
    case "slider":
      return `${SLIDERS[action.slider].name} trick`;
  }
}

/** The Take back button for what it would reverse: greyed out when there is nothing. */
export function takeBackButton(next: TakeBackAction | null): {
  readonly disabled: boolean;
  readonly label: string;
} {
  return next === null
    ? { disabled: true, label: "Nothing to take back" }
    : { disabled: false, label: `Take back: ${takeBackName(next)}` };
}

export interface HudHandlers {
  readonly onChoosePiece: (pieceId: PieceId) => void;
  readonly onChooseDudeKind: (dudeKind: DudeKindId) => void;
  readonly onChooseEraser: () => void;
  readonly onFight: () => void;
  /** The Take back button, or Ctrl+Z / Cmd+Z. */
  readonly onTakeBack: () => void;
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
  private readonly roundHint: HTMLElement;
  private readonly message: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  /** The Round whose Curse was last announced, so each Round's is announced once. */
  private announcedRound: number | null = null;
  /** What Take back would reverse now; the button is rebuilt with the shop, so this outlives it. */
  private nextTakeBack: TakeBackAction | null = null;
  private takeBackButton: HTMLButtonElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    /** A getter, because Unlocks change what the shop sells from one Run to the next. */
    private readonly stock: () => ShopStock,
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
    this.roundHint = this.doc.createElement("p");
    this.roundHint.className = "hud-round-hint";
    this.roundHint.hidden = true;
    this.message = this.doc.createElement("p");
    this.message.className = "hud-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    host.replaceChildren(top, this.hint, this.roundHint, this.message);
    this.doc.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
      if (event.key.toLowerCase() !== "z") return;
      // A text box keeps its own Ctrl+Z.
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      handlers.onTakeBack();
    });
  }

  /** What the Take back button would reverse, or null to grey it out. */
  showTakeBack(next: TakeBackAction | null): void {
    this.nextTakeBack = next;
    if (this.takeBackButton !== null) this.labelTakeBack(this.takeBackButton);
  }

  /** "Took back: Crate Wall", after a Take back. */
  showTookBack(action: TakeBackAction): void {
    this.showMessage(`Took back: ${takeBackName(action)}`);
  }

  showRunStatus(status: RunStatus): void {
    this.status.textContent = runStatus(status);
    const hint = roundHint(status.round, status.firstRun);
    this.roundHint.textContent = hint ?? "";
    this.roundHint.hidden = hint === null;
    const announcements = [
      ...(status.boss === null ? [] : [bossAnnouncement(status.boss)]),
      ...(status.curse === null ? [] : [curseAnnouncement(status.curse)]),
    ];
    if (announcements.length > 0 && status.round !== this.announcedRound) {
      this.showMessage(announcements.join(" "));
    }
    this.announcedRound = status.round;
    // The heading and the chosen button wear the side's colour.
    this.host.setAttribute("data-side", status.side);
  }

  showDefenseBuilding(chosen: PieceId): void {
    this.heading.textContent = SIDE_NAMES.defense;
    this.showShop(
      defenseItems(this.stock()),
      chosen,
      this.handlers.onChoosePiece,
    );
    this.hint.textContent = `Shop: pick a Piece, then tap a tile to buy it with Defense gold, or tap a Piece to see what it does. Placing a ${PIECES[chosen].name} now. Drag to pan; pinch or scroll to zoom.`;
  }

  /**
   * The unit bar: `chosen` is the brush, unless `erasing` picks the eraser; `freeItems` put each
   * gift's count on its kind.
   */
  showAttackBuilding(
    chosen: DudeKindId,
    freeItems: readonly FreeItem[],
    erasing: boolean,
  ): void {
    this.heading.textContent = SIDE_NAMES.attack;
    const eraser = this.button("Eraser", erasing, this.handlers.onChooseEraser);
    this.showShop(
      attackItems(this.stock(), freeItems),
      erasing ? null : chosen,
      this.handlers.onChooseDudeKind,
      eraser,
    );
    this.hint.textContent = erasing
      ? "Eraser: drag over Dudes in the Spawn zone. This Round's Dudes are Erased for their price back; older ones, dimmed, are Dismissed for nothing."
      : `Unit bar: pick a Dude kind, then drag in the Spawn zone, the 3 left columns, to paint ${DUDE_KINDS[chosen].name}s, each paid with Attack gold as it appears. Drag elsewhere to pan. The whole Army charges your own Maze at once.`;
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

  /**
   * One button per item the side's shop sells, with its price, the chosen one pressed (none when
   * `chosen` is null), any `tools` after them, then Take back and Fight.
   */
  private showShop<Id extends string>(
    items: readonly ShopItem<Id>[],
    chosen: Id | null,
    onChoose: (id: Id) => void,
    ...tools: HTMLButtonElement[]
  ): void {
    const choiceButtons = items.map((item) =>
      this.button(itemLabel(item), item.id === chosen, () => {
        onChoose(item.id);
      }),
    );
    const takeBack = this.button("↶ Take back", null, this.handlers.onTakeBack);
    takeBack.classList.add("hud-take-back");
    this.labelTakeBack(takeBack);
    this.takeBackButton = takeBack;
    const fight = this.button("Fight", null, this.handlers.onFight);
    fight.classList.add("hud-fight");
    this.controls.replaceChildren(...choiceButtons, ...tools, takeBack, fight);
  }

  private labelTakeBack(button: HTMLButtonElement): void {
    const { disabled, label } = takeBackButton(this.nextTakeBack);
    button.disabled = disabled;
    button.title = label;
    button.setAttribute("aria-label", label);
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
