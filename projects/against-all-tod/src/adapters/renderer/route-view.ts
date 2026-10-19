import type { Graphics } from "pixi.js";
import { SPAWN_ZONE_COLUMNS, spawnZoneTiles, tileKey } from "../../maze/board";
import { pathToGoal, type Route } from "../../maze/route";
import { TILE_SIZE } from "./board-textures";
import { ATTACK_COLOUR } from "./board-view";

/**
 * The route preview: the path from every tile of the Spawn zone's front column to the Goal
 * (every route out of the zone crosses it), each shared stretch drawn once, so the player sees
 * where the Army funnels through the Maze.
 */
export function drawRoute(graphics: Graphics, route: Route): void {
  graphics.clear();
  const drawn = new Set<string>();
  const front = spawnZoneTiles().filter(
    ({ column }) => column === SPAWN_ZONE_COLUMNS - 1,
  );
  for (const start of front) {
    const path = pathToGoal(route, start);
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      if (from === undefined || to === undefined) continue;
      const key = `${tileKey(from)}>${tileKey(to)}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      graphics
        .moveTo(centre(from.column), centre(from.row))
        .lineTo(centre(to.column), centre(to.row));
    }
  }
  graphics.stroke({
    color: ATTACK_COLOUR,
    alpha: 0.55,
    width: 6,
    cap: "round",
    join: "round",
  });
}

function centre(index: number): number {
  return (index + 0.5) * TILE_SIZE;
}
