import type { Surface, World } from "../world/world";
import type { Plane } from "./plane";
import { TUNING } from "./tuning";
import { length } from "./vector";

export type Ending = "landed" | "landedOffRunway" | "crashed";

export type CrashCause = "tooHard" | "tooBanked" | "noseDown" | "lake" | "hill";

/** The numbers shown when a Flight ends. Metres, metres per second and radians. */
export interface TouchdownStats {
  /** How fast the Plane was coming down, positive downwards. */
  readonly sinkRate: number;
  readonly speed: number;
  /** Right wing down positive. */
  readonly bank: number;
  readonly centrelineDistance: number;
}

export interface FlightEnd {
  readonly ending: Ending;
  readonly stats: TouchdownStats;
  /** What went wrong, for a crash. */
  readonly crashCause: CrashCause | null;
}

/** A gentle Touchdown the Plane is still rolling out from: the Flight ends once it stops. */
export interface RollOut {
  readonly stats: TouchdownStats;
  readonly surface: Surface;
}

export interface Judgement {
  readonly rollOut: RollOut | null;
  readonly flightEnd: FlightEnd | null;
}

/**
 * Whether one step of the flight model, from `before` to `after`, ended the Flight. A gentle
 * Touchdown on the Runway or grass ends it once the Plane rolls to a stop; a hard one, or any
 * contact with a hill or the lake, ends it at once. Lifting off again forgets the Touchdown.
 */
export function judgeStep(
  before: Plane,
  after: Plane,
  rollOut: RollOut | null,
  world: World,
): Judgement {
  if (!after.onGround) return { rollOut: null, flightEnd: null };
  const { x, y } = after.position;
  const surface = world.surfaceAt(x, y);
  if (!before.onGround) {
    // The step before contact still has the attitude and sink rate the wheels took away.
    const stats = touchdownStats(before, after, world);
    const cause = crashCause(before, stats, surface);
    if (cause !== null) return crashed(stats, cause);
    return { rollOut: { stats, surface }, flightEnd: null };
  }
  if (surface === "lake" || surface === "hill") {
    return crashed(
      rollOut?.stats ?? touchdownStats(after, after, world),
      surface,
    );
  }
  if (rollOut === null || length(after.velocity) >= TUNING.stoppedSpeed) {
    return { rollOut, flightEnd: null };
  }
  const ending = rollOut.surface === "runway" ? "landed" : "landedOffRunway";
  return {
    rollOut: null,
    flightEnd: { ending, stats: rollOut.stats, crashCause: null },
  };
}

function touchdownStats(
  before: Plane,
  after: Plane,
  world: World,
): TouchdownStats {
  return {
    sinkRate: -before.velocity.z,
    speed: length(before.velocity),
    bank: before.roll,
    centrelineDistance: world.centrelineDistance(
      after.position.x,
      after.position.y,
    ),
  };
}

function crashCause(
  plane: Plane,
  stats: TouchdownStats,
  surface: Surface,
): CrashCause | null {
  if (surface === "lake" || surface === "hill") return surface;
  if (stats.sinkRate >= TUNING.maxGentleSinkRate) return "tooHard";
  if (Math.abs(stats.bank) >= TUNING.maxGentleBank) return "tooBanked";
  if (plane.pitch < 0) return "noseDown";
  return null;
}

function crashed(stats: TouchdownStats, cause: CrashCause): Judgement {
  return {
    rollOut: null,
    flightEnd: { ending: "crashed", stats, crashCause: cause },
  };
}
