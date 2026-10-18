import type { Side } from "../battle/battle";
import { DUDE_KINDS } from "../catalog/dudes";
import { MUTATIONS } from "../catalog/mutations";
import { PIECES } from "../catalog/pieces";
import { CRATE_RULES, type CrateItem } from "../catalog/pools";
import type { Crate } from "../run/crate";
import type { FreeItem } from "../run/run";

/** "Sniper Nest", "Intern Squad" or "Gold Teeth Mutation". */
export function crateItemName(item: CrateItem): string {
  switch (item.kind) {
    case "piece":
      return PIECES[item.id].name;
    case "squad":
      return `${DUDE_KINDS[item.id].name} Squad`;
    case "mutation":
      return `${MUTATIONS[item.id].name} Mutation`;
  }
}

export function crateItemDescription(item: CrateItem): string {
  switch (item.kind) {
    case "piece":
      return PIECES[item.id].description;
    case "squad":
      return DUDE_KINDS[item.id].description;
    case "mutation":
      return MUTATIONS[item.id].description;
  }
}

/** "Reroll · 15g", in the side's own gold. */
export function rerollLabel(side: Side): string {
  return `Reroll · ${String(CRATE_RULES.rerollPrice[side])}g`;
}

export interface CrateHandlers {
  readonly onTake: (index: number) => void;
  readonly onReroll: () => void;
}

/** The Round's Draft Crate: pick one item for free, or reroll. Then a reminder of the free item. */
export class CratePanel {
  private readonly doc: Document;

  constructor(
    private readonly host: HTMLElement,
    private readonly handlers: CrateHandlers,
  ) {
    this.doc = host.ownerDocument;
    host.hidden = true;
  }

  /** Hidden when the crate is taken and nothing free is waiting. */
  show(crate: Crate | null, freeItem: FreeItem | null, side: Side): void {
    if (crate !== null) {
      this.showCrate(crate, side);
    } else if (freeItem !== null) {
      this.showFreeItem(freeItem);
    } else {
      this.hide();
    }
  }

  hide(): void {
    this.host.hidden = true;
  }

  private showCrate(crate: Crate, side: Side): void {
    const heading = this.doc.createElement("h2");
    heading.textContent = "Draft Crate: take one for free";
    const items = crate.items.map((item, index) => {
      const button = this.button(crateItemName(item), () => {
        this.handlers.onTake(index);
      });
      button.title = crateItemDescription(item);
      return button;
    });
    const reroll = this.button(rerollLabel(side), this.handlers.onReroll);
    reroll.className = "crate-reroll";
    const row = this.doc.createElement("div");
    row.className = "crate-items";
    row.append(...items, reroll);
    this.host.replaceChildren(heading, row);
    this.host.hidden = false;
  }

  private showFreeItem(item: FreeItem): void {
    const line = this.doc.createElement("p");
    line.textContent = `Free from the crate: your next ${crateItemName(item)}.`;
    this.host.replaceChildren(line);
    this.host.hidden = false;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
}
