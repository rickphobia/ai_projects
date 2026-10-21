import type { Side } from "../battle/battle";
import {
  SLIDER_IDS,
  SLIDERS,
  TRICK_RULES,
  type SliderId,
} from "../catalog/tricks";
import { sideHelped, type SliderPositions } from "../tricks/tricks";
import { COIN_ICON, iconElement, SKULL_ICON, TRICK_ICONS } from "./trick-icons";

/** Shown instead of the step hints for a slider that can't be dragged during a battle. */
export const BETWEEN_BATTLES_HINT = "Only between battles";

/** What a drag one step each way would cost now; null at that end of the slider. */
export type PriceOf = (slider: SliderId, to: number) => number | null;

/** "Darker: towers see less far… · helps attack · 20g", or "… · at the end" once it can't go further. */
export function stepHint(
  slider: SliderId,
  direction: -1 | 1,
  price: number | null,
): string {
  const entry = SLIDERS[slider];
  const label = direction < 0 ? entry.downLabel : entry.upLabel;
  const cost = price === null ? "at the end" : `${String(price)}g`;
  return `${label} · helps ${sideHelped(slider, direction)} · ${cost}`;
}

/** "-2" to "+2", with "0" for the neutral middle. */
export function positionLabel(position: number): string {
  return position > 0 ? `+${String(position)}` : String(position);
}

/** The coin chip on a slider's handle: "◀ 20g · 40g ▶", with "–" for an end it can't pass. */
export function handlePrice(down: number | null, up: number | null): string {
  const cost = (price: number | null): string =>
    price === null ? "–" : `${String(price)}g`;
  return `◀ ${cost(down)} · ${cost(up)} ▶`;
}

/** Where the handle sits along the track, as a percentage from the left (down) end. */
export function handlePercent(position: number): number {
  const steps = TRICK_RULES.stepsEachWay;
  return ((position + steps) / (2 * steps)) * 100;
}

/** "Undo · destroy 40g of your own Pieces", or "Undo · free" with a free Undo. */
export function undoLabel(side: Side, price: number): string {
  if (price === 0) return "Undo · free";
  return `Undo · destroy ${String(price)}g of your own ${side === "defense" ? "Pieces" : "Dudes"}`;
}

/** "Brightness Undo: picked 30g of 40g. Tap your Pieces to pick them." */
export function undoPickHint(
  slider: SliderId,
  side: Side,
  picked: number,
  price: number,
): string {
  const how =
    side === "defense"
      ? "Tap your Pieces to pick them."
      : "Drag over your Dudes to pick them.";
  return `${SLIDERS[slider].name} Undo: picked ${String(picked)}g of ${String(price)}g. ${how}`;
}

/** An Undo being paid for: the slider, its price and the value picked so far. */
export interface UndoPicking {
  readonly slider: SliderId;
  readonly price: number;
  readonly picked: number;
}

export interface SettingsHandlers {
  readonly onDrag: (slider: SliderId, to: number) => void;
  /** Starts picking what to destroy for an Undo of `slider`. */
  readonly onUndo: (slider: SliderId) => void;
  readonly onPayUndo: () => void;
  readonly onCancelUndo: () => void;
}

/**
 * The game's own Settings menu: a button that opens a slider per trick, each showing where it
 * stands, which side each way helps and what a step costs the side being played. A refused drag
 * snaps back, as the panel always redraws from the Run.
 */
export class SettingsMenu {
  private readonly doc: Document;
  private readonly panel: HTMLElement;
  private readonly toggle: HTMLButtonElement;

  constructor(
    private readonly host: HTMLElement,
    private readonly handlers: SettingsHandlers,
  ) {
    this.doc = host.ownerDocument;
    this.toggle = this.doc.createElement("button");
    this.toggle.type = "button";
    this.toggle.className = "btn settings-toggle";
    this.toggle.textContent = "Settings";
    this.toggle.setAttribute("aria-expanded", "false");
    this.panel = this.doc.createElement("div");
    this.panel.className = "card settings-panel";
    this.panel.hidden = true;
    this.toggle.addEventListener("click", () => {
      this.panel.hidden = !this.panel.hidden;
      this.toggle.setAttribute("aria-expanded", String(!this.panel.hidden));
    });
    host.replaceChildren(this.toggle, this.panel);
  }

  /**
   * Redraws every slider where the Run has it, with prices for the side paying now. `undoPriceOf`
   * is null when no Undo can start now (mid-battle); `picking` is the Undo being paid for.
   */
  show(
    sliders: SliderPositions,
    side: Side,
    midBattle: boolean,
    priceOf: PriceOf,
    undoPriceOf: ((slider: SliderId) => number) | null,
    picking: UndoPicking | null,
  ): void {
    const heading = this.doc.createElement("h2");
    heading.textContent = "Settings";
    const note = this.doc.createElement("p");
    note.className = "settings-note";
    note.textContent = midBattle
      ? `Mid-battle: every drag costs ${String(TRICK_RULES.midBattleMultiplier)}× in ${side} gold.`
      : `Every drag costs ${side} gold; back toward the middle costs ${String(TRICK_RULES.towardMiddleMultiplier)}×.`;
    const rows = SLIDER_IDS.map((slider) => {
      const row = this.sliderRow(slider, sliders[slider], midBattle, priceOf);
      if (undoPriceOf !== null && picking === null && sliders[slider] !== 0) {
        row.append(this.undoButton(slider, side, undoPriceOf(slider)));
      }
      return row;
    });
    const pickBar = picking === null ? [] : [this.pickBar(picking, side)];
    this.panel.replaceChildren(heading, note, ...pickBar, ...rows);
  }

  private undoButton(slider: SliderId, side: Side, price: number): HTMLElement {
    const button = this.button(undoLabel(side, price), () => {
      this.handlers.onUndo(slider);
    });
    button.className = "btn settings-undo";
    button.prepend(iconElement(this.doc, SKULL_ICON));
    return button;
  }

  private pickBar(picking: UndoPicking, side: Side): HTMLElement {
    const bar = this.doc.createElement("div");
    bar.className = "settings-undo-picking";
    const pay = this.button("Pay and Undo", () => {
      this.handlers.onPayUndo();
    });
    pay.disabled = picking.picked < picking.price;
    const cancel = this.button("Cancel", () => {
      this.handlers.onCancelUndo();
    });
    bar.append(
      this.hint(
        undoPickHint(picking.slider, side, picking.picked, picking.price),
      ),
      pay,
      cancel,
    );
    return bar;
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  private sliderRow(
    slider: SliderId,
    position: number,
    midBattle: boolean,
    priceOf: PriceOf,
  ): HTMLElement {
    const row = this.doc.createElement("div");
    row.className = "settings-slider";
    const name = this.doc.createElement("span");
    name.className = "settings-name";
    name.textContent = `${SLIDERS[slider].name} ${positionLabel(position)}`;
    const input = this.doc.createElement("input");
    input.type = "range";
    input.min = String(-TRICK_RULES.stepsEachWay);
    input.max = String(TRICK_RULES.stepsEachWay);
    input.step = "1";
    input.value = String(position);
    input.setAttribute("aria-label", SLIDERS[slider].name);
    input.addEventListener("change", () => {
      this.handlers.onDrag(slider, Number(input.value));
    });
    if (midBattle && !SLIDERS[slider].midBattle) {
      input.disabled = true;
      row.append(
        name,
        this.track(slider, position, input, null),
        this.hint(BETWEEN_BATTLES_HINT),
      );
      return row;
    }
    const down = priceOf(slider, position - 1);
    const up = priceOf(slider, position + 1);
    row.append(
      name,
      this.track(slider, position, input, handlePrice(down, up)),
      this.hint(stepHint(slider, -1, down)),
      this.hint(stepHint(slider, 1, up)),
    );
    return row;
  }

  /**
   * The slider between its end icons, its track coloured by the side each end helps, with the
   * price chip riding the handle (no chip while the slider is locked).
   */
  private track(
    slider: SliderId,
    position: number,
    input: HTMLInputElement,
    price: string | null,
  ): HTMLElement {
    const track = this.doc.createElement("div");
    track.className = "settings-track";
    track.style.setProperty("--down-side", `var(--${sideHelped(slider, -1)})`);
    track.style.setProperty("--up-side", `var(--${sideHelped(slider, 1)})`);
    track.style.setProperty("--handle", `${String(handlePercent(position))}%`);
    const rail = this.doc.createElement("div");
    rail.className = "settings-rail";
    rail.append(input);
    if (price !== null) {
      const chip = this.doc.createElement("span");
      chip.className = "chip settings-price";
      chip.append(iconElement(this.doc, COIN_ICON), price);
      rail.append(chip);
    }
    track.append(
      iconElement(this.doc, TRICK_ICONS[slider].down),
      rail,
      iconElement(this.doc, TRICK_ICONS[slider].up),
    );
    return track;
  }

  private hint(text: string): HTMLElement {
    const line = this.doc.createElement("p");
    line.textContent = text;
    return line;
  }
}
