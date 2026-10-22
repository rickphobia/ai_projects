import type { Side } from "../battle/battle";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { MUTATIONS } from "../catalog/mutations";
import { PIECES, type PieceId } from "../catalog/pieces";
import { CRATE_RULES, type CrateItem } from "../catalog/pools";
import type { Crate } from "../run/crate";
import type { FreeItem } from "../run/run";
import { FREE_UNDO_MARK, MUTATION_MARKS } from "./crate-marks";
import type { Portraits } from "./shop";
import { iconElement } from "./trick-icons";

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

/** A crate card's picture: a Dude kind's or Piece's portrait, or an inline SVG mark. */
export type CardPicture =
  | {
      readonly kind: "portrait";
      readonly id: DudeKindId | PieceId;
      /** "×20" on a gift of free Dudes. */
      readonly badge: string | null;
    }
  | { readonly kind: "mark"; readonly svg: string };

export interface CrateCard {
  readonly name: string;
  readonly description: string;
  readonly picture: CardPicture;
}

/** What one crate card shows, all from the catalogues. */
export function crateCard(item: CrateItem): CrateCard {
  return {
    name: crateItemName(item),
    description: crateItemDescription(item),
    picture: cardPicture(item),
  };
}

function cardPicture(item: CrateItem): CardPicture {
  switch (item.kind) {
    case "piece":
      return { kind: "portrait", id: item.id, badge: null };
    case "gift":
      return {
        kind: "portrait",
        id: item.id,
        badge: `×${String(DUDE_KINDS[item.id].giftSize)}`,
      };
    case "mutation":
      return { kind: "mark", svg: MUTATION_MARKS[item.id] };
    case "free-undo":
      return { kind: "mark", svg: FREE_UNDO_MARK };
  }
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
 * The Round's crate: a picture card per item to take for free, and a reroll in the corner. Under it, and once it is taken, a reminder of each
 * free item still waiting.
 */
export class CratePanel {
  private readonly doc: Document;
  private folded = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly portraits: Portraits,
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
    this.folded = false;
    this.host.classList.remove("crate-folded");
  }

  private crateParts(crate: Crate, side: Side): HTMLElement[] {
    const heading = this.doc.createElement("h2");
    heading.className = "ribbon";
    // Tapping the ribbon folds the cards away, so a small screen can see the Board behind them.
    const fold = this.doc.createElement("button");
    fold.type = "button";
    fold.className = "crate-fold";
    fold.textContent = `${crateHeading(crate)} ${this.folded ? "▴" : "▾"}`;
    fold.setAttribute("aria-expanded", String(!this.folded));
    fold.addEventListener("click", () => {
      this.folded = !this.folded;
      this.host.classList.toggle("crate-folded", this.folded);
      fold.textContent = `${crateHeading(crate)} ${this.folded ? "▴" : "▾"}`;
      fold.setAttribute("aria-expanded", String(!this.folded));
    });
    heading.append(fold);
    const cards = crate.items.map((item, index) =>
      this.card(crateCard(item), () => {
        this.handlers.onTake(index);
      }),
    );
    const reroll = this.button(rerollLabel(side), this.handlers.onReroll);
    reroll.classList.add("crate-reroll");
    const row = this.doc.createElement("div");
    row.className = "crate-items";
    row.append(...cards);
    return [heading, reroll, row];
  }

  private card(card: CrateCard, onChoose: () => void): HTMLElement {
    const article = this.doc.createElement("article");
    article.className = "crate-card";
    const name = this.doc.createElement("h3");
    name.textContent = card.name;
    const description = this.doc.createElement("p");
    description.textContent = card.description;
    const choose = this.button("Choose", onChoose);
    choose.setAttribute("aria-label", `Choose ${card.name}`);
    article.append(name, this.picture(card.picture), description, choose);
    return article;
  }

  /** The name already says what it is, so screen readers skip the picture. */
  private picture(picture: CardPicture): HTMLElement {
    const frame = this.doc.createElement("div");
    frame.className = "crate-picture";
    if (picture.kind === "mark") {
      frame.append(iconElement(this.doc, picture.svg));
      return frame;
    }
    const portrait = this.doc.createElement("img");
    portrait.src = this.portraits[picture.id];
    portrait.alt = "";
    frame.append(portrait);
    if (picture.badge !== null) {
      const badge = this.doc.createElement("span");
      badge.className = "crate-badge";
      badge.textContent = picture.badge;
      frame.append(badge);
    }
    return frame;
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
