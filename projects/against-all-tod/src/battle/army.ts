import {
  DUDE_KINDS,
  paintRadius,
  ROUND_ONE_ARMY,
  type DudeKindId,
} from "../catalog/dudes";
import { isInSpawnZone, spawnZoneRows } from "../maze/board";
import { createRng } from "../rng/rng";
import { NEUTRAL_SLIDERS } from "../tricks/tricks";
import type { BoardPoint } from "./events";

/** One Dude the attacker painted into the Spawn zone; it stands there at the start of every battle. */
export interface PlacedDude {
  readonly dudeKind: DudeKindId;
  /** In tiles, inside the Spawn zone. */
  readonly at: BoardPoint;
  /** The drag it was painted in; Conga Line walks each Stroke in single file. */
  readonly stroke: number;
  /** The Round it was painted in. */
  readonly round: number;
  /** Painted from a crate gift, so Erasing it gives it back to the gift instead of gold. */
  readonly fromGift?: true;
}

/** Every Dude placed so far, in paint order; it all attacks each battle. */
export type Army = readonly PlacedDude[];

/** Whether `at` is inside the Spawn zone at a Window size; false off the Board. */
export function isSpawnZonePoint(at: BoardPoint, windowSize: number): boolean {
  return isInSpawnZone(
    { column: Math.floor(at.x), row: Math.floor(at.y) },
    windowSize,
  );
}

/**
 * The Army once the Spawn zone has the rows it has at `windowSize`: each Dude standing in a row
 * that closed moves straight up or down into the nearest open row, keeping its place within the
 * row, so Dudes from several closed rows end up closer together than painting allows. The move
 * is to the painted spot itself, so the Bouncer sends a Dude back to where it now stands. Dudes
 * already in an open row stay put, and the same Army comes back when none had to move.
 */
export function squeezeArmy(army: Army, windowSize: number): Army {
  const { first, last } = spawnZoneRows(windowSize);
  const squeezed = army.map((dude) => {
    const row = Math.floor(dude.at.y);
    const intoRow = Math.min(last, Math.max(first, row));
    if (intoRow === row) return dude;
    return { ...dude, at: { x: dude.at.x, y: dude.at.y - row + intoRow } };
  });
  return squeezed.every((dude, index) => dude === army[index])
    ? army
    : squeezed;
}

/** Whether a Dude of `kind` at `at` keeps its room from every Dude in the Army. */
export function hasRoom(army: Army, kind: DudeKindId, at: BoardPoint): boolean {
  const radius = paintRadius(kind);
  return army.every((placed) => {
    const apart = radius + paintRadius(placed.dudeKind);
    const dx = placed.at.x - at.x;
    const dy = placed.at.y - at.y;
    return dx * dx + dy * dy >= apart * apart;
  });
}

/** The Stroke number a new drag takes: one past the highest in the Army. */
export function nextStroke(army: Army): number {
  return army.reduce((next, { stroke }) => Math.max(next, stroke + 1), 0);
}

/**
 * Giant Mutation: whether each Dude in the Army is giant. Every Nth Dude of a kind in paint
 * order is (N being the kind's `giantEvery`), so painting order, not spot, picks them.
 */
export function giantsOf(army: Army): boolean[] {
  const counts = new Map<DudeKindId, number>();
  return army.map(({ dudeKind }) => {
    const count = (counts.get(dudeKind) ?? 0) + 1;
    counts.set(dudeKind, count);
    return count % DUDE_KINDS[dudeKind].giantEvery === 0;
  });
}

/** Tries per Dude before the layout gives up on a blob that is full. */
const LAYOUT_TRIES = 200;

/**
 * Round 1's game-made Army: each blob a Stroke of Interns at seeded spots around its centre,
 * keeping the same room painting does.
 */
export function roundOneArmy(seed: number): Army {
  const rng = createRng(seed);
  const { dudeKind, dudesPerBlob, blobCentres, blobRadius } = ROUND_ONE_ARMY;
  const army: PlacedDude[] = [];
  for (const [stroke, centre] of blobCentres.entries()) {
    let placed = 0;
    for (let tries = 0; placed < dudesPerBlob; tries++) {
      if (tries > dudesPerBlob * LAYOUT_TRIES) break;
      const angle = rng() * 2 * Math.PI;
      const distance = Math.sqrt(rng()) * blobRadius;
      const at = {
        x: centre.x + Math.cos(angle) * distance,
        y: centre.y + Math.sin(angle) * distance,
      };
      // A Run starts with the Window size in the middle.
      const zoneAt = isSpawnZonePoint(at, NEUTRAL_SLIDERS["window-size"]);
      if (!zoneAt || !hasRoom(army, dudeKind, at)) continue;
      army.push({ dudeKind, at, stroke, round: 1 });
      placed++;
    }
  }
  return army;
}
