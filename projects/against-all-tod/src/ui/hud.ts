import type { BattleOutcome, Side } from "../battle/battle";
import type { Wallets } from "../economy/economy";
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
  priceTag,
  type Portraits,
  type ShopItem,
  type ShopStock,
} from "./shop";
import { DudeInfo, dudeInfoContent } from "./dude-info";
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

/** One chip on the top bar: an icon and a short value, with the full words for screen readers. */
export interface StatusChip {
  readonly kind:
    | "lives"
    | "defense-gold"
    | "attack-gold"
    | "army"
    | "score"
    | "round"
    | "curse"
    | "boss";
  /** Empty for a chip that is only words. */
  readonly icon: string;
  readonly text: string;
  readonly label: string;
}

/**
 * ❤ Lives, 🛡 Defense gold and ⚔ Attack gold in words, 👥 the Army, ★ Score and the Round, then
 * the Round's Curse and boss, if any.
 */
export function statusChips(status: RunStatus): StatusChip[] {
  const count = (
    kind: StatusChip["kind"],
    icon: string,
    name: string,
    value: number,
  ): StatusChip => ({
    kind,
    icon,
    text: String(value),
    label: `${name} ${String(value)}`,
  });
  const gold = (
    kind: StatusChip["kind"],
    icon: string,
    name: string,
    value: number,
  ): StatusChip => {
    const words = `${name} ${String(value)}`;
    return { kind, icon, text: words, label: words };
  };
  const round = `Round ${String(status.round)}`;
  const dudes = `${String(status.armySize)} ${status.armySize === 1 ? "Dude" : "Dudes"}`;
  const chips: StatusChip[] = [
    count("lives", "❤", "Lives", status.lives),
    gold("defense-gold", "🛡", "Defense gold", status.wallets.defense),
    gold("attack-gold", "⚔", "Attack gold", status.wallets.attack),
    { kind: "army", icon: "👥", text: dudes, label: `Army: ${dudes}` },
    count("score", "★", "Score", status.score),
    { kind: "round", icon: "", text: round, label: round },
  ];
  if (status.curse !== null) {
    const { name } = CURSES[status.curse];
    chips.push({
      kind: "curse",
      icon: "☠",
      text: name,
      label: curseStatus(status.curse),
    });
  }
  if (status.boss !== null) {
    const { name } = BOSSES[status.boss];
    chips.push({
      kind: "boss",
      icon: "👑",
      text: name,
      label: `Boss: ${name}`,
    });
  }
  return chips;
}

/** A short "+12" or "−3" (a real minus sign) to pop on a wallet's chip. */
export interface GoldPop {
  readonly side: Side;
  readonly text: string;
}

/** What each wallet gained or lost since `before`; nothing the first time. */
export function goldPops(before: Wallets | null, after: Wallets): GoldPop[] {
  if (before === null) return [];
  const sides: readonly Side[] = ["defense", "attack"];
  return sides.flatMap((side) => {
    const change = after[side] - before[side];
    if (change === 0) return [];
    const text = change > 0 ? `+${String(change)}` : `\u2212${String(-change)}`;
    return [{ side, text }];
  });
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

/**
 * The DOM bands around the Board: the Run's status, the turn and why an action was refused along
 * the top; what to do and the turn's buttons in a tray along the bottom.
 */
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
  private readonly dudeInfo: DudeInfo;
  /** The wallets last shown, so a change pops on its chip. */
  private shownWallets: Wallets | null = null;

  constructor(
    private readonly host: HTMLElement,
    /** A getter, because Unlocks change what the shop sells from one Run to the next. */
    private readonly stock: () => ShopStock,
    private readonly portraits: Portraits,
    private readonly handlers: HudHandlers,
  ) {
    this.doc = host.ownerDocument;
    const top = this.doc.createElement("div");
    top.className = "hud-top";
    this.status = this.doc.createElement("ul");
    this.status.className = "hud-status";
    this.status.setAttribute("aria-label", "Run status");
    this.heading = this.doc.createElement("h1");
    this.heading.className = "chip hud-turn";
    top.append(this.status, this.heading);
    const band = this.doc.createElement("div");
    band.className = "hud-band";
    const tray = this.doc.createElement("div");
    tray.className = "hud-tray";
    this.controls = this.doc.createElement("div");
    this.controls.className = "hud-controls";
    this.hint = this.doc.createElement("p");
    this.roundHint = this.doc.createElement("p");
    this.roundHint.className = "hud-round-hint";
    this.roundHint.hidden = true;
    this.message = this.doc.createElement("p");
    this.message.className = "hud-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    band.append(top, this.message);
    tray.append(this.roundHint, this.hint, this.controls);
    host.replaceChildren(band, tray);
    this.dudeInfo = new DudeInfo(this.doc);
    this.followHeight(band, "--hud-height");
    this.followHeight(tray, "--tray-height");
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
    this.status.replaceChildren(
      ...statusChips(status).map((chip) => this.chip(chip)),
    );
    for (const pop of goldPops(this.shownWallets, status.wallets)) {
      this.popGold(pop);
    }
    this.shownWallets = status.wallets;
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
      "defense",
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
    const items = attackItems(this.stock(), freeItems);
    this.showShop(
      "attack",
      items,
      erasing ? null : chosen,
      this.handlers.onChooseDudeKind,
      eraser,
    );
    this.addDudeInfoButtons(items);
    this.hint.textContent = erasing
      ? "Eraser: drag over Dudes in the Spawn zone. This Round's Dudes are Erased for their price back; older ones, dimmed, are Dismissed for nothing."
      : `Unit bar: drag in the Spawn zone, the 3 left columns, to paint ${DUDE_KINDS[chosen].name}s with Attack gold. ⓘ explains a Dude.`;
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

  /** A short message under the status chips that fades after a few seconds. */
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
   * `chosen` is null), then any `tools`, Take back and Fight at the tray's right end.
   */
  private showShop<Id extends DudeKindId | PieceId>(
    side: Side,
    items: readonly ShopItem<Id>[],
    chosen: Id | null,
    onChoose: (id: Id) => void,
    ...tools: HTMLButtonElement[]
  ): void {
    const choiceButtons = items.map((item) => {
      const button = this.button(item.name, item.id === chosen, () => {
        onChoose(item.id);
      });
      button.append(" ", priceTag(this.doc, item.price, side));
      if (item.free !== undefined) {
        button.append(` · ${String(item.free)} free`);
      }
      button.setAttribute("aria-label", itemLabel(item, side));
      // The label already names the item, so screen readers skip the picture.
      const portrait = this.doc.createElement("img");
      portrait.className = "shop-portrait";
      portrait.src = this.portraits[item.id];
      portrait.alt = "";
      button.classList.add("shop-item");
      button.prepend(portrait);
      return button;
    });
    const takeBack = this.button("↶ Take back", null, this.handlers.onTakeBack);
    takeBack.classList.add("hud-take-back");
    this.labelTakeBack(takeBack);
    this.takeBackButton = takeBack;
    const fight = this.button("Fight", null, this.handlers.onFight);
    fight.classList.add("hud-fight");
    const choices = this.doc.createElement("div");
    choices.className = "hud-choices";
    choices.append(...choiceButtons);
    this.controls.replaceChildren(choices, ...tools, takeBack, fight);
  }

  /** Puts an ⓘ on each Dude kind card's corner; a sibling of the card, so tapping it never picks the brush. */
  private addDudeInfoButtons(items: readonly ShopItem<DudeKindId>[]): void {
    const cards = this.controls.querySelectorAll(".hud-choices .shop-item");
    items.forEach((item, index) => {
      const card = cards[index];
      if (card === undefined) return;
      const slot = this.doc.createElement("span");
      slot.className = "shop-slot";
      card.replaceWith(slot);
      const info = this.doc.createElement("button");
      info.type = "button";
      info.className = "shop-info";
      info.textContent = "ⓘ";
      info.setAttribute("aria-label", `About ${item.name}`);
      info.addEventListener("click", () => {
        this.dudeInfo.show(
          dudeInfoContent(DUDE_KINDS[item.id], item.price),
          this.portraits[item.id],
        );
      });
      slot.append(card, info);
    });
  }

  /**
   * Each band is as tall as its text needs, so nothing is clipped; the Board and the panels
   * beside it read that height from `variable`.
   */
  private followHeight(band: HTMLElement, variable: string): void {
    const view = this.doc.defaultView;
    if (view === null) return;
    const root = this.doc.documentElement;
    new view.ResizeObserver(() => {
      const height = `${String(Math.ceil(band.getBoundingClientRect().height))}px`;
      if (root.style.getPropertyValue(variable) === height) return;
      root.style.setProperty(variable, height);
      // PixiJS's resizeTo only listens for window resizes, and the Board's box just changed.
      view.dispatchEvent(new Event("resize"));
    }).observe(band);
  }

  private labelTakeBack(button: HTMLButtonElement): void {
    const { disabled, label } = takeBackButton(this.nextTakeBack);
    button.disabled = disabled;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  /** Floats "+12" or "−3" off the wallet's chip, then removes it; CSS skips it for reduced motion. */
  private popGold({ side, text }: GoldPop): void {
    const chip = this.status.querySelector(`.chip-${side}-gold`);
    if (chip === null) return;
    const pop = this.doc.createElement("span");
    pop.className = "chip-pop";
    pop.setAttribute("aria-hidden", "true");
    pop.textContent = text;
    pop.addEventListener("animationend", () => {
      pop.remove();
    });
    chip.append(pop);
  }

  /** The icon is hidden from screen readers, which read the label instead. */
  private chip({ kind, icon, text, label }: StatusChip): HTMLLIElement {
    const chip = this.doc.createElement("li");
    chip.className = `chip chip-${kind}`;
    chip.title = label;
    chip.setAttribute("aria-label", label);
    if (icon !== "") {
      const glyph = this.doc.createElement("span");
      glyph.className = "chip-icon";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = icon;
      chip.append(glyph);
    }
    chip.append(text);
    return chip;
  }

  /** `pressed` is null for a plain button, true or false for one of a set of choices. */
  private button(
    label: string,
    pressed: boolean | null,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = label;
    if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", onClick);
    return button;
  }
}
