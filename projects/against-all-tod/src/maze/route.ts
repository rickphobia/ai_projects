import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  allTiles,
  goalTiles,
  isOnBoard,
  type Tile,
} from "./board";

/** Which way a Dude on a tile walks next. */
export type Step = "up" | "down" | "left" | "right";

/**
 * One shortest-route direction field from the Goal, shared by every Dude: each tile holds
 * its step toward the Goal, so hundreds of Dudes cost one calculation per Maze change.
 */
export interface Route {
  /** Steps to the Goal, by tile index; null where the Goal can't be reached. */
  readonly distances: readonly (number | null)[];
  readonly steps: readonly (Step | null)[];
}

const STEP_OFFSETS: Readonly<Record<Step, Tile>> = {
  right: { column: 1, row: 0 },
  down: { column: 0, row: 1 },
  up: { column: 0, row: -1 },
  left: { column: -1, row: 0 },
};

/** Fixed so the field, and every battle built on it, is the same on every machine. */
const STEP_ORDER: readonly Step[] = ["right", "down", "up", "left"];

/** Where routes aim when several steps are equally short, so they cut toward the Goal rather than run along an edge. */
const GOAL_CENTRE = goalCentre();

/** Breadth-first from every Goal tile over the tiles `isWalkable` allows. */
export function computeRoute(isWalkable: (tile: Tile) => boolean): Route {
  const distances: (number | null)[] = new Array<number | null>(
    BOARD_COLUMNS * BOARD_ROWS,
  ).fill(null);
  const queue = goalTiles();
  for (const tile of queue) distances[indexOf(tile)] = 0;

  // An array iterator also visits what is pushed during the loop, which makes it a queue.
  for (const tile of queue) {
    const distance = (distances[indexOf(tile)] ?? 0) + 1;
    for (const [, neighbour] of neighbours(tile)) {
      if (distances[indexOf(neighbour)] !== null || !isWalkable(neighbour)) {
        continue;
      }
      distances[indexOf(neighbour)] = distance;
      queue.push(neighbour);
    }
  }

  const steps = allTiles().map((tile) => bestStep(tile, distances));
  return { distances, steps };
}

export function routeStep(
  route: Route,
  tile: Tile,
): Step | "at-goal" | "no-route" {
  if (route.distances[indexOf(tile)] === 0) return "at-goal";
  return route.steps[indexOf(tile)] ?? "no-route";
}

export function reachesGoal(route: Route, tile: Tile): boolean {
  return route.distances[indexOf(tile)] != null;
}

/** Steps left from `tile` to the Goal; null where the Goal can't be reached. */
export function distanceToGoal(route: Route, tile: Tile): number | null {
  return route.distances[indexOf(tile)] ?? null;
}

/** The tiles a Dude walks from `start` to a Goal tile, both included; empty if there is no route. */
export function pathToGoal(route: Route, start: Tile): Tile[] {
  if (!reachesGoal(route, start)) return [];
  const path = [start];
  let current = start;
  for (;;) {
    const step = routeStep(route, current);
    if (step === "at-goal" || step === "no-route") return path;
    current = moved(current, step);
    path.push(current);
  }
}

/** The neighbour one step closer to the Goal, picking the one nearest the Goal's centre on a tie. */
function bestStep(
  tile: Tile,
  distances: readonly (number | null)[],
): Step | null {
  const distance = distances[indexOf(tile)];
  if (distance == null || distance === 0) return null;
  let best: { step: Step; distanceToGoalCentre: number } | null = null;
  for (const [step, neighbour] of neighbours(tile)) {
    if (distances[indexOf(neighbour)] !== distance - 1) continue;
    const distanceToGoalCentre = Math.hypot(
      neighbour.column - GOAL_CENTRE.column,
      neighbour.row - GOAL_CENTRE.row,
    );
    if (best === null || distanceToGoalCentre < best.distanceToGoalCentre) {
      best = { step, distanceToGoalCentre };
    }
  }
  return best?.step ?? null;
}

function neighbours(tile: Tile): [Step, Tile][] {
  return STEP_ORDER.map((step): [Step, Tile] => [
    step,
    moved(tile, step),
  ]).filter(([, neighbour]) => isOnBoard(neighbour));
}

function moved(tile: Tile, step: Step): Tile {
  const offset = STEP_OFFSETS[step];
  return { column: tile.column + offset.column, row: tile.row + offset.row };
}

function indexOf(tile: Tile): number {
  return tile.row * BOARD_COLUMNS + tile.column;
}

function goalCentre(): { column: number; row: number } {
  const goal = goalTiles();
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    column: mean(goal.map((tile) => tile.column)),
    row: mean(goal.map((tile) => tile.row)),
  };
}
