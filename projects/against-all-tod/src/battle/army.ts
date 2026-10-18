import type { DudeKindId } from "../catalog/dudes";

/** A group of Dudes of one kind, placed together on one Spawn line tile. */
export interface Squad {
  readonly dudeKind: DudeKindId;
  /** The Spawn line is one column, so its row names the tile. */
  readonly spawnRow: number;
}

/** Every Squad placed so far; it all attacks each battle. */
export type Army = readonly Squad[];
