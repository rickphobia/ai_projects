import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import { dudePrice, piecePrice, type FreeItem } from "../run/run";

/** What the shop sells each side. Unlocks (a later ticket) will narrow it. */
export interface ShopStock {
  readonly pieces: readonly PieceId[];
  readonly dudeKinds: readonly DudeKindId[];
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

/** "Sniper Nest · 40g", or "Intern · 1g · 12 free" while a gift lasts, for a shop button. */
export function itemLabel(item: ShopItem<string>): string {
  const label = `${item.name} · ${String(item.price)}g`;
  return item.free === undefined
    ? label
    : `${label} · ${String(item.free)} free`;
}
