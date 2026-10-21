import type { Graphics } from "pixi.js";
import {
  SPAWN_ZONE_COLUMNS,
  spawnZoneTiles,
  tileKey,
  type Tile,
} from "../../maze/board";
import { pathToGoal, type Route } from "../../maze/route";
import { TILE_SIZE } from "./board-textures";
import { ATTACK_COLOUR, OUTLINE_COLOUR } from "./board-view";

/** One step of the route preview, from a tile to its neighbour. */
export interface RouteStretch {
  readonly from: Tile;
  readonly to: Tile;
}

/** A dash and the gap after it; a tile-to-tile step holds a whole number of them, so dashes line up across tiles. */
const DASH_LENGTH = 18;
const DASH_PERIOD = TILE_SIZE / 2;
const DASH_WIDTH = 7;
/** A soft dark edge under the dashes, so they read on both grass shades and on the carpet. */
const DASH_EDGE_WIDTH = 11;
const DASH_EDGE_ALPHA = 0.3;

/**
 * The route preview's steps: the path from every tile of the Spawn zone's front column to the
 * Goal (every route out of the zone crosses it), each shared stretch listed once.
 */
export function routeStretches(
  route: Route,
  windowSize: number,
): RouteStretch[] {
  const stretches: RouteStretch[] = [];
  const listed = new Set<string>();
  const front = spawnZoneTiles(windowSize).filter(
    ({ column }) => column === SPAWN_ZONE_COLUMNS - 1,
  );
  for (const start of front) {
    const path = pathToGoal(route, start);
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      if (from === undefined || to === undefined) continue;
      const key = `${tileKey(from)}>${tileKey(to)}`;
      if (listed.has(key)) continue;
      listed.add(key);
      stretches.push({ from, to });
    }
  }
  return stretches;
}

/** The route preview as a dashed path, so the player sees where the Army funnels through the Maze. */
export function drawRoute(
  graphics: Graphics,
  route: Route,
  windowSize: number,
): void {
  graphics.clear();
  const stretches = routeStretches(route, windowSize);
  for (const { from, to } of stretches) traceDashes(graphics, from, to);
  graphics.stroke({
    color: OUTLINE_COLOUR,
    alpha: DASH_EDGE_ALPHA,
    width: DASH_EDGE_WIDTH,
    cap: "round",
  });
  for (const { from, to } of stretches) traceDashes(graphics, from, to);
  graphics.stroke({ color: ATTACK_COLOUR, width: DASH_WIDTH, cap: "round" });
}

/** Steps are one tile up, down, left or right, so each holds exactly two dashes. */
function traceDashes(graphics: Graphics, from: Tile, to: Tile): void {
  const startX = centre(from.column);
  const startY = centre(from.row);
  const dx = Math.sign(to.column - from.column);
  const dy = Math.sign(to.row - from.row);
  for (let offset = 0; offset < TILE_SIZE; offset += DASH_PERIOD) {
    graphics
      .moveTo(startX + dx * offset, startY + dy * offset)
      .lineTo(
        startX + dx * (offset + DASH_LENGTH),
        startY + dy * (offset + DASH_LENGTH),
      );
  }
}

function centre(index: number): number {
  return (index + 0.5) * TILE_SIZE;
}
