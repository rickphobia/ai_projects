import { TRICK_RULES } from "../catalog/tricks";
import { tileKey, type Tile } from "../maze/board";
import type { Maze } from "../maze/maze";
import type { SliderPositions } from "../tricks/tricks";
import { litTiles } from "./area-effects";

/** What the Settings tricks do in a battle step: Dude speed, and tower range and reloading. */

/** How the tricks change towers this step. */
export interface TowerTricks {
  /** The range multiplier for a tower standing on `tile`. */
  readonly rangeFactor: (tile: Tile) => number;
  /** The multiplier on the time between shots. */
  readonly reloadFactor: number;
}

export const NO_TOWER_TRICKS: TowerTricks = {
  rangeFactor: () => 1,
  reloadFactor: 1,
};

/**
 * In the dark every tower's range shrinks, except on tiles a Lighthouse lights (the Lighthouse's
 * own beam is not a tower, so the dark never touches it). Game speed up slows reloading; down
 * speeds it.
 */
export function towerTricks(sliders: SliderPositions, maze: Maze): TowerTricks {
  const reloadFactor =
    1 + TRICK_RULES.reloadPerGameStep * sliders["game-speed"];
  const dark = Math.max(0, -sliders.brightness);
  if (dark === 0) return { ...NO_TOWER_TRICKS, reloadFactor };
  const lit = litTilesOf(maze);
  const darkFactor = Math.max(0, 1 - TRICK_RULES.rangeLossPerDarkStep * dark);
  return {
    rangeFactor: (tile) => (lit.has(tileKey(tile)) ? 1 : darkFactor),
    reloadFactor,
  };
}

/** A battle's Maze changes only when a Piece is destroyed, so its lit tiles are worked out once per Maze. */
const litCache = new WeakMap<Maze, ReadonlySet<string>>();

function litTilesOf(maze: Maze): ReadonlySet<string> {
  let lit = litCache.get(maze);
  if (lit === undefined) {
    lit = litTiles(maze);
    litCache.set(maze, lit);
  }
  return lit;
}

/** Every Dude's speed multiplier: Brightness up dazzles and slows; Game speed moves it either way. */
export function dudeSpeedFactor(sliders: SliderPositions): number {
  const bright = Math.max(0, sliders.brightness);
  return (
    Math.max(0, 1 - TRICK_RULES.slowPerBrightStep * bright) *
    (1 + TRICK_RULES.dudeSpeedPerGameStep * sliders["game-speed"])
  );
}
