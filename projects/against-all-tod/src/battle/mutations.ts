import {
  MUTATION_RULES,
  type MutationId,
  type MutationRules,
} from "../catalog/mutations";
import type { Route } from "../maze/route";
import { createRng } from "../rng/rng";
import {
  MAX_LANE,
  reachGoal,
  squaredDistance,
  walk,
  type DudeState,
} from "./dudes";
import type { BattleEvent, KillEvent } from "./events";
import type { TowerState } from "./towers";

/**
 * What the Army's Mutations do in battle. Each one changes every Dude for the rest of the Run,
 * and they stack: all the Army has apply at once. Damage-side effects (Explosive Shields'
 * small shield, Conga Line's shared damage) live in `DudeHits`; this module makes the Dudes,
 * turns the dead into halves or ghosts, walks the ghosts and stuns towers near a burst shield.
 * Gold Teeth is the economy's.
 */

/** Ghost Mode: a dead Dude still walking until `fadesAtStep`. Nothing can hurt, stun or catch it. */
export interface Ghost {
  readonly dude: DudeState;
  readonly fadesAtStep: number;
}

/**
 * A Dude of the Army as the Mutations make it: a giant if `giant` (see `giantsOf`), and under
 * Conga Line one of its Stroke's single file, walking the tile centre line.
 */
export function mutatedDude(
  dude: DudeState,
  stroke: number,
  giant: boolean,
  mutations: readonly MutationId[],
  rules: MutationRules = MUTATION_RULES,
): DudeState {
  let result = dude;
  if (mutations.includes("giant") && giant) {
    const health = result.health * rules.giantHealthMultiplier;
    result = { ...result, health, fullHealth: health, giant: true };
  }
  if (mutations.includes("explosive-shields")) {
    result = { ...result, smallShield: rules.smallShieldHealth };
  }
  if (mutations.includes("conga-line")) {
    result = { ...result, congaStroke: stroke, lane: 0 };
  }
  return result;
}

/** How fast the Mutations let a Dude walk, as a share of its kind's speed. */
export function mutationSpeedFactor(
  dude: DudeState,
  rules: MutationRules = MUTATION_RULES,
): number {
  return dude.giant ? rules.giantSpeedMultiplier : 1;
}

export interface Afterlife {
  readonly halves: DudeState[];
  readonly ghosts: Ghost[];
  /** The id the next new Dude gets. */
  readonly nextDudeId: number;
}

/**
 * What the Mutations make of the Dudes killed in a step: under Split each becomes two halves
 * where it died, each with half its full health (a giant's halves are tough but not giant); under Ghost Mode a Dude that doesn't split
 * (a half, or anyone without Split) walks on as a ghost. `before` holds the Dudes as the step
 * began. Halves spread across the tile with a roll seeded by the battle and the dead Dude.
 */
export function afterDeaths(
  kills: readonly KillEvent[],
  before: readonly DudeState[],
  mutations: readonly MutationId[],
  step: number,
  stepsPerSecond: number,
  seed: number,
  nextDudeId: number,
  rules: MutationRules = MUTATION_RULES,
): Afterlife {
  const halves: DudeState[] = [];
  const ghosts: Ghost[] = [];
  let nextId = nextDudeId;
  const splits = mutations.includes("split");
  const ghostMode = mutations.includes("ghost-mode");
  if (kills.length === 0 || (!splits && !ghostMode)) {
    return { halves, ghosts, nextDudeId };
  }
  const byId = new Map(before.map((dude) => [dude.id, dude]));
  for (const kill of kills) {
    const dead = byId.get(kill.dudeId);
    if (dead === undefined) continue;
    const at = { ...dead, x: kill.at.x, y: kill.at.y };
    if (splits && !dead.half) {
      // A roll of its own per dead Dude (golden-ratio mixing), so halves don't depend on kill order.
      const rng = createRng((seed ^ Math.imul(dead.id + 1, 0x9e3779b1)) >>> 0);
      const health = dead.fullHealth * rules.splitHealthShare;
      for (let index = 0; index < 2; index++) {
        // A Conga Line half stays in the single file.
        const spread = clampLane(dead.lane + (rng() * 2 - 1) * MAX_LANE);
        const lane = dead.congaStroke === undefined ? spread : 0;
        halves.push({
          ...at,
          id: nextId++,
          lane,
          health,
          fullHealth: health,
          shield: 0,
          // A half is a Dude of its own: never a giant, but it has a fresh small shield.
          smallShield: mutations.includes("explosive-shields")
            ? rules.smallShieldHealth
            : 0,
          giant: false,
          half: true,
        });
      }
    } else if (ghostMode) {
      ghosts.push({
        dude: { ...at, burrowTo: null, tunnelsLeft: 0 },
        fadesAtStep: step + Math.round(rules.ghostSeconds * stepsPerSecond),
      });
    }
  }
  return { halves, ghosts, nextDudeId: nextId };
}

export interface GhostWalk {
  readonly ghosts: Ghost[];
  /** Goal health the ghosts reaching the Goal took. */
  readonly goalDamage: number;
}

/**
 * One step for the ghosts: each walks the route, and one reaching the Goal damages it and
 * counts as reaching it (so it pays); a ghost whose time is up fades.
 */
export function walkGhosts(
  ghosts: readonly Ghost[],
  route: Route,
  step: number,
  stepSeconds: number,
  events: BattleEvent[],
): GhostWalk {
  const walking: Ghost[] = [];
  let goalDamage = 0;
  for (const ghost of ghosts) {
    if (ghost.fadesAtStep <= step) continue;
    const moved = walk(
      ghost.dude,
      route,
      stepSeconds,
      mutationSpeedFactor(ghost.dude),
    );
    if (moved !== "at-goal") {
      walking.push({ ...ghost, dude: moved });
      continue;
    }
    const reached = reachGoal(ghost.dude, step);
    goalDamage += reached.damage;
    events.push(reached);
  }
  return { ghosts: walking, goalDamage };
}

/** Explosive Shields: every tower near a shield that broke this step is stunned. */
export function stunTowers(
  towers: readonly TowerState[],
  events: readonly BattleEvent[],
  step: number,
  stepsPerSecond: number,
  rules: MutationRules = MUTATION_RULES,
): TowerState[] {
  const bursts = events.flatMap((event) =>
    event.type === "shield-burst" ? [event.at] : [],
  );
  if (bursts.length === 0) return [...towers];
  const range = rules.shieldBurstRange;
  const until =
    step + Math.round(rules.shieldBurstStunSeconds * stepsPerSecond);
  return towers.map((tower) => {
    const centre = { x: tower.tile.column + 0.5, y: tower.tile.row + 0.5 };
    const near = bursts.some(
      (at) => squaredDistance(at, centre) <= range * range,
    );
    return near ? { ...tower, stunnedUntilStep: until } : tower;
  });
}

function clampLane(lane: number): number {
  return Math.max(-MAX_LANE, Math.min(MAX_LANE, lane));
}
