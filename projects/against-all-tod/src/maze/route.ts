import {
  LARGEST_BOARD_TILE_COUNT,
  MAX_WINDOW_STEPS,
  allTiles,
  goalTiles,
  isOnBoard,
  isOnLargestBoard,
  tileIndex,
  tileKind,
  type Tile,
} from "./board";

/** Which way a Dude on a tile walks next. */
export type Step = "up" | "down" | "left" | "right";

/**
 * One shortest-route direction field from the Goal, shared by every Dude: each tile holds
 * its step toward the Goal, so hundreds of Dudes cost one calculation per Maze change. It covers
 * the largest Board, so lookups never need the Window size; tiles off the Board reach nothing.
 */
export interface Route {
  /** Route cost to the target (steps, on an ordinary route), by tile index; null where it can't be reached. */
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

const LARGEST_BOARD_TILES = allTiles(MAX_WINDOW_STEPS);

/** Breadth-first from every Goal tile over the tiles `isWalkable` allows at a Window size. */
export function computeRoute(
  isWalkable: (tile: Tile) => boolean,
  windowSize: number,
): Route {
  return computeWeightedRoute(
    (tile) => (isWalkable(tile) ? 1 : null),
    windowSize,
  );
}

/**
 * The cheapest-route field toward `targets` (the Goal unless given), where stepping onto a tile
 * costs `enterCost` and null means it can't be entered; stepping onto a target costs 1. Tiles off
 * the Board at `windowSize`, and Spawn zone tiles it has closed, can't be entered either. Costs
 * are whole numbers, so one bucket per total cost is the whole priority queue.
 */
export function computeWeightedRoute(
  enterCost: (tile: Tile) => number | null,
  windowSize: number,
  targets: readonly Tile[] = goalTiles(),
): Route {
  const distances = new Array<number | null>(LARGEST_BOARD_TILE_COUNT).fill(
    null,
  );
  const costs = LARGEST_BOARD_TILES.map((tile) =>
    isOnBoard(tile, windowSize) && tileKind(tile, windowSize) !== "closed"
      ? enterCost(tile)
      : null,
  );
  for (const tile of targets) {
    distances[indexOf(tile)] = 0;
    costs[indexOf(tile)] = 1;
  }

  const buckets: Tile[][] = [[...targets]];
  for (let distance = 0; distance < buckets.length; distance++) {
    for (const tile of buckets[distance] ?? []) {
      // A tile can sit in several buckets; only its cheapest visit counts.
      if (distances[indexOf(tile)] !== distance) continue;
      const reached = distance + (costs[indexOf(tile)] ?? 1);
      for (const [, neighbour] of neighbours(tile)) {
        const index = indexOf(neighbour);
        const known = distances[index] ?? null;
        if (costs[index] === null || (known !== null && known <= reached)) {
          continue;
        }
        distances[index] = reached;
        (buckets[reached] ??= []).push(neighbour);
      }
    }
  }

  const steps = LARGEST_BOARD_TILES.map((tile) =>
    bestStep(tile, distances, costs),
  );
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

/** The neighbour on a cheapest route, picking the one nearest the Goal's centre on a tie. */
function bestStep(
  tile: Tile,
  distances: readonly (number | null)[],
  costs: readonly (number | null)[],
): Step | null {
  const distance = distances[indexOf(tile)];
  if (distance == null || distance === 0) return null;
  let best: { step: Step; distanceToGoalCentre: number } | null = null;
  for (const [step, neighbour] of neighbours(tile)) {
    const there = distances[indexOf(neighbour)];
    const cost = costs[indexOf(neighbour)];
    if (there == null || cost == null || there + cost !== distance) continue;
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
  ]).filter(([, neighbour]) => isOnLargestBoard(neighbour));
}

function moved(tile: Tile, step: Step): Tile {
  const offset = STEP_OFFSETS[step];
  return { column: tile.column + offset.column, row: tile.row + offset.row };
}

/** -1 off the largest Board, which every lookup reads as nothing there. */
function indexOf(tile: Tile): number {
  return isOnLargestBoard(tile) ? tileIndex(tile) : -1;
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
