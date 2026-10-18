import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import { piecePrice, squadPrice } from "../run/run";

/** What the shop sells each side. Draft Crates and Unlocks (later tickets) will narrow it. */
export interface ShopStock {
  readonly pieces: readonly PieceId[];
  readonly dudeKinds: readonly DudeKindId[];
}

export interface ShopItem<Id extends string> {
  readonly id: Id;
  readonly name: string;
  /** In the gold of the side that buys it. */
  readonly price: number;
}

export function defenseItems(stock: ShopStock): ShopItem<PieceId>[] {
  return stock.pieces.map((id) => ({
    id,
    name: PIECES[id].name,
    price: piecePrice(id),
  }));
}

export function attackItems(stock: ShopStock): ShopItem<DudeKindId>[] {
  return stock.dudeKinds.map((id) => ({
    id,
    name: `${DUDE_KINDS[id].name} Squad`,
    price: squadPrice(id),
  }));
}

/** "Sniper Nest · 40g", for a shop button. */
export function itemLabel(item: ShopItem<string>): string {
  return `${item.name} · ${String(item.price)}g`;
}
