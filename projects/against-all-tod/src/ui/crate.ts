import type { Side } from "../battle/battle";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { MUTATIONS } from "../catalog/mutations";
import { PIECES } from "../catalog/pieces";
import { CRATE_RULES, type CrateItem } from "../catalog/pools";
import type { Crate } from "../run/crate";
import type { FreeItem } from "../run/run";

/** "Sniper Nest", "20 free Interns", "Gold Teeth Mutation" or "Free Undo". */
export function crateItemName(item: CrateItem): string {
  switch (item.kind) {
    case "piece":
      return PIECES[item.id].name;
    case "gift":
      return freeDudes(item.id, DUDE_KINDS[item.id].giftSize);
    case "mutation":
      return `${MUTATIONS[item.id].name} Mutation`;
    case "free-undo":
      return "Free Undo";
  }
}

export function crateItemDescription(item: CrateItem): string {
  switch (item.kind) {
    case "piece":
      return PIECES[item.id].description;
    case "gift":
      return DUDE_KINDS[item.id].description;
    case "mutation":
      return MUTATIONS[item.id].description;
    case "free-undo":
      return "Undo one Settings trick later without destroying anything.";
  }
}

/** "20 free Interns", "1 free Ram Crew". */
function freeDudes(dudeKind: DudeKindId, count: number): string {
  const name = DUDE_KINDS[dudeKind].name;
  return `${String(count)} free ${count === 1 ? name : `${name}s`}`;
}

/** The reminder once an item is taken: what is still free to place. */
export function freeItemLine(item: FreeItem): string {
  if (item.kind === "piece") {
    return `Free from the crate: your next ${PIECES[item.id].name}.`;
  }
  return `Free from the crate: ${freeDudes(item.id, item.left)} left to paint.`;
}

/** "Draft Crate: take one for free", or "Boss crate: take 2 for free". */
export function crateHeading(crate: Crate): string {
  const name = crate.kind === "draft" ? "Draft Crate" : "Boss crate";
  const picks = crate.picks === 1 ? "one" : String(crate.picks);
  return `${name}: take ${picks} for free`;
}

/** "Reroll · 15g", in the side's own gold. */
export function rerollLabel(side: Side): string {
  return `Reroll · ${String(CRATE_RULES.rerollPrice[side])}g`;
}

export interface CrateHandlers {
  readonly onTake: (index: number) => void;
  readonly onReroll: () => void;
}

/**
 * The Round's crate: pick for free, or reroll. Under it, and once it is taken, a reminder of each
 * free item still waiting.
 */
export class CratePanel {
  private readonly doc: Document;

  constructor(
    private readonly host: HTMLElement,
    private readonly handlers: CrateHandlers,
  ) {
    this.doc = host.ownerDocument;
    host.classList.add("card");
    host.hidden = true;
  }

  /** Hidden when the crate is taken and nothing free is waiting. */
  show(crate: Crate | null, freeItems: readonly FreeItem[], side: Side): void {
    const lines = freeItems.map((item) => {
      const line = this.doc.createElement("p");
      line.textContent = freeItemLine(item);
      return line;
    });
    if (crate === null && lines.length === 0) {
      this.hide();
      return;
    }
    this.host.replaceChildren(
      ...(crate === null ? [] : this.crateParts(crate, side)),
      ...lines,
    );
    // The ribbon wears the colour of the side the crate is for.
    this.host.style.setProperty("--side", `var(--${side})`);
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }

  private crateParts(crate: Crate, side: Side): HTMLElement[] {
    const heading = this.doc.createElement("h2");
    heading.className = "ribbon";
    heading.textContent = crateHeading(crate);
    const items = crate.items.map((item, index) => {
      const button = this.button(crateItemName(item), () => {
        this.handlers.onTake(index);
      });
      button.title = crateItemDescription(item);
      return button;
    });
    const reroll = this.button(rerollLabel(side), this.handlers.onReroll);
    reroll.classList.add("crate-reroll");
    const row = this.doc.createElement("div");
    row.className = "crate-items";
    row.append(...items, reroll);
    return [heading, row];
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
}
