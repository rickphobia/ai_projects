import type { DudeKindId } from "../catalog/dudes";
import type { Tile } from "../maze/board";

/** A group of Dudes of one kind, standing spread over one Spawn zone tile. */
export interface Squad {
  readonly dudeKind: DudeKindId;
  readonly tile: Tile;
}

/** Every Squad placed so far; it all attacks each battle. */
export type Army = readonly Squad[];
