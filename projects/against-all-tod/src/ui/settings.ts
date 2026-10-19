import type { Side } from "../battle/battle";
import {
  SLIDER_IDS,
  SLIDERS,
  TRICK_RULES,
  type SliderId,
} from "../catalog/tricks";
import { sideHelped, type SliderPositions } from "../tricks/tricks";

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

export interface SettingsHandlers {
  readonly onDrag: (slider: SliderId, to: number) => void;
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
    this.toggle.className = "settings-toggle";
    this.toggle.textContent = "Settings";
    this.toggle.setAttribute("aria-expanded", "false");
    this.panel = this.doc.createElement("div");
    this.panel.className = "settings-panel";
    this.panel.hidden = true;
    this.toggle.addEventListener("click", () => {
      this.panel.hidden = !this.panel.hidden;
      this.toggle.setAttribute("aria-expanded", String(!this.panel.hidden));
    });
    host.replaceChildren(this.toggle, this.panel);
  }

  /** Redraws every slider where the Run has it, with prices for the side paying now. */
  show(
    sliders: SliderPositions,
    side: Side,
    midBattle: boolean,
    priceOf: PriceOf,
  ): void {
    const heading = this.doc.createElement("h2");
    heading.textContent = "Settings";
    const note = this.doc.createElement("p");
    note.className = "settings-note";
    note.textContent = midBattle
      ? `Mid-battle: every drag costs ${String(TRICK_RULES.midBattleMultiplier)}× in ${side} gold.`
      : `Every drag costs ${side} gold; back toward the middle costs ${String(TRICK_RULES.towardMiddleMultiplier)}×.`;
    const rows = SLIDER_IDS.map((slider) =>
      this.sliderRow(slider, sliders[slider], priceOf),
    );
    this.panel.replaceChildren(heading, note, ...rows);
  }

  private sliderRow(
    slider: SliderId,
    position: number,
    priceOf: PriceOf,
  ): HTMLElement {
    const row = this.doc.createElement("div");
    row.className = "settings-slider";
    const label = this.doc.createElement("label");
    const name = this.doc.createElement("span");
    name.textContent = `${SLIDERS[slider].name} ${positionLabel(position)}`;
    const input = this.doc.createElement("input");
    input.type = "range";
    input.min = String(-TRICK_RULES.stepsEachWay);
    input.max = String(TRICK_RULES.stepsEachWay);
    input.step = "1";
    input.value = String(position);
    input.addEventListener("change", () => {
      this.handlers.onDrag(slider, Number(input.value));
    });
    label.append(name, input);
    const down = this.hint(stepHint(slider, -1, priceOf(slider, position - 1)));
    const up = this.hint(stepHint(slider, 1, priceOf(slider, position + 1)));
    row.append(label, down, up);
    return row;
  }

  private hint(text: string): HTMLElement {
    const line = this.doc.createElement("p");
    line.textContent = text;
    return line;
  }
}
