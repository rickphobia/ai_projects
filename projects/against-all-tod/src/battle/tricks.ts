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
  /** The furthest a tower can target, in tiles, however long its range: Volume down hides Dudes. */
  readonly sightTiles: number;
}

export const NO_TOWER_TRICKS: TowerTricks = {
  rangeFactor: () => 1,
  reloadFactor: 1,
  sightTiles: Infinity,
};

/**
 * In the dark every tower's range shrinks, except on tiles a Lighthouse lights (the Lighthouse's
 * own beam is not a tower, so the dark never touches it). Game speed up slows reloading; down
 * speeds it. Volume down hides Dudes from towers until they come close.
 */
export function towerTricks(sliders: SliderPositions, maze: Maze): TowerTricks {
  const reloadFactor =
    1 + TRICK_RULES.reloadPerGameStep * sliders["game-speed"];
  const sightTiles = quietSight(sliders.volume);
  const dark = Math.max(0, -sliders.brightness);
  if (dark === 0) return { ...NO_TOWER_TRICKS, reloadFactor, sightTiles };
  const lit = litTilesOf(maze);
  const darkFactor = Math.max(0, 1 - TRICK_RULES.rangeLossPerDarkStep * dark);
  return {
    rangeFactor: (tile) => (lit.has(tileKey(tile)) ? 1 : darkFactor),
    reloadFactor,
    sightTiles,
  };
}

/** How near a Dude must be for a tower to target it at a Volume position: no limit unless quiet. */
export function quietSight(volume: number): number {
  const quiet = Math.max(0, -volume);
  return quiet === 0
    ? Infinity
    : (TRICK_RULES.quietSightTiles[quiet - 1] ?? Infinity);
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
