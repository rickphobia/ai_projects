import type { Side } from "../battle/battle";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import { dudeKindsOnSale } from "../progress/progress";
import { dudePrice, piecePrice, type FreeItem } from "../run/run";

/** What the shop sells each side. */
export interface ShopStock {
  readonly pieces: readonly PieceId[];
  readonly dudeKinds: readonly DudeKindId[];
}

/** Each Dude kind's and Piece's drawing as an image URL, for its shop button. */
export type Portraits = Readonly<Record<DudeKindId | PieceId, string>>;

/** The Pieces the shop sells; the others come only from crates. */
const SHOP_PIECES: readonly PieceId[] = ["crate-wall", "sniper-nest"];

/** What the shop sells at this best Score: Dude kinds join it as they are Unlocked. */
export function shopStock(bestScore: number): ShopStock {
  return { pieces: SHOP_PIECES, dudeKinds: dudeKindsOnSale(bestScore) };
}

export interface ShopItem<Id extends string> {
  readonly id: Id;
  readonly name: string;
  /** In the gold of the side that buys it: per Piece, or per painted Dude. */
  readonly price: number;
  /** Dudes of this kind the crate gift still holds; absent when none. */
  readonly free?: number;
}

export function defenseItems(stock: ShopStock): ShopItem<PieceId>[] {
  return stock.pieces.map((id) => ({
    id,
    name: PIECES[id].name,
    price: piecePrice(id),
  }));
}

/**
 * The unit bar: every Dude kind on sale with its price per Dude, plus each crate gift's kind if
 * the shop doesn't sell it, with the gift's count on its kind.
 */
export function attackItems(
  stock: ShopStock,
  freeItems: readonly FreeItem[],
): ShopItem<DudeKindId>[] {
  const gifts = new Map(
    freeItems.flatMap((item) =>
      item.kind === "gift" ? [[item.id, item.left] as const] : [],
    ),
  );
  const kinds = [
    ...stock.dudeKinds,
    ...[...gifts.keys()].filter((id) => !stock.dudeKinds.includes(id)),
  ];
  return kinds.map((id) => {
    const free = gifts.get(id);
    return {
      id,
      name: DUDE_KINDS[id].name,
      price: dudePrice(id),
      ...(free === undefined ? {} : { free }),
    };
  });
}

const GOLD_NAMES: Readonly<Record<Side, string>> = {
  defense: "Defense gold",
  attack: "Attack gold",
};

/** "40 Defense gold": a price in words, for screen readers and plain text. */
export function priceWords(price: number, side: Side): string {
  return `${String(price)} ${GOLD_NAMES[side]}`;
}

/**
 * "Sniper Nest, 40 Defense gold", or "Intern, 1 Attack gold, 12 free" while a gift lasts: what a
 * shop button says to screen readers; the screen shows the price as a coin.
 */
export function itemLabel(item: ShopItem<string>, side: Side): string {
  const label = `${item.name}, ${priceWords(item.price, side)}`;
  return item.free === undefined
    ? label
    : `${label}, ${String(item.free)} free`;
}

/** A price as a coin in the side's colour and the number; screen readers get the words. */
export function priceTag(
  doc: Document,
  price: number,
  side: Side,
): HTMLElement {
  const tag = doc.createElement("span");
  tag.className = "price";
  tag.setAttribute("aria-label", priceWords(price, side));
  const coin = doc.createElement("span");
  coin.className = `coin coin-${side}`;
  coin.setAttribute("aria-hidden", "true");
  tag.append(coin, String(price));
  return tag;
}
