import {
  isSpawnZonePoint,
  type Army,
  type PlacedDude,
} from "../../battle/army";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import { PIECES, type PieceId } from "../../catalog/pieces";
import { MUTATIONS, type MutationId } from "../../catalog/mutations";
import type { CrateItem } from "../../catalog/pools";
import { SLIDER_IDS, type SliderId } from "../../catalog/tricks";
import type { Wallets } from "../../economy/economy";
import type { Logger } from "../../logger";
import type { Tile } from "../../maze/board";
import type { PlacedPiece } from "../../maze/maze";
import type { Crate } from "../../run/crate";
import {
  mazeOf,
  type FreeItem,
  type RoundSnapshot,
  type RunPhase,
  type RunState,
} from "../../run/run";
import {
  isSliderPosition,
  type SliderInput,
  type SliderPositions,
} from "../../tricks/tricks";

/**
 * Saves the Run to browser storage and loads it back. A save that can't be read, or comes from
 * another save version, is dropped for a fresh start: a warning is logged and the caller shows a
 * message, never a crash.
 */

/** Bump when the saved shape changes; older saves then give a fresh start. */
export const SAVE_VERSION = 5;
export const SAVE_KEY = "against-all-tod.save";
/** The pause menu's actual volume, kept apart from the Run so a new Run keeps it. */
export const ACTUAL_VOLUME_KEY = "against-all-tod.actual-volume";

/** The part of `Storage` the save needs, so tests can pass a fake. */
export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type LoadResult =
  | { readonly kind: "empty" }
  | { readonly kind: "loaded"; readonly run: RunState }
  /** There was a save, but it couldn't be used; `reason` is for the log. */
  | { readonly kind: "unreadable"; readonly reason: string };

/** A saved value didn't have the expected shape. */
export class SaveFormatError extends Error {
  override name = "SaveFormatError";
}

export class SaveStore {
  constructor(
    /** A getter, because reading `window.localStorage` itself throws where storage is blocked. */
    private readonly storage: () => KeyValueStorage,
    private readonly logger: Logger,
  ) {}

  save(run: RunState): void {
    try {
      this.storage().setItem(
        SAVE_KEY,
        JSON.stringify({ version: SAVE_VERSION, run }),
      );
    } catch (error) {
      // Full or blocked storage loses the save, not the game.
      this.logger.warn("save failed", { error });
    }
  }

  load(): LoadResult {
    let raw: string | null;
    try {
      raw = this.storage().getItem(SAVE_KEY);
    } catch (error) {
      return this.unreadable(`storage blocked: ${describe(error)}`);
    }
    if (raw === null) return { kind: "empty" };
    try {
      return { kind: "loaded", run: parseSave(raw) };
    } catch (error) {
      return this.unreadable(describe(error));
    }
  }

  saveActualVolume(volume: number): void {
    try {
      this.storage().setItem(ACTUAL_VOLUME_KEY, String(volume));
    } catch (error) {
      this.logger.warn("actual volume not saved", { error });
    }
  }

  /** The saved actual volume, or `fallback` when there is none or it can't be read. */
  loadActualVolume(fallback: number): number {
    let raw: string | null;
    try {
      raw = this.storage().getItem(ACTUAL_VOLUME_KEY);
    } catch (error) {
      this.logger.warn("actual volume unreadable", { error });
      return fallback;
    }
    if (raw === null) return fallback;
    const volume = Number(raw);
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      this.logger.warn("actual volume unreadable", { raw });
      return fallback;
    }
    return volume;
  }

  private unreadable(reason: string): LoadResult {
    // Only the reason is logged, never the save itself.
    this.logger.warn("save unreadable, starting fresh", { reason });
    return { kind: "unreadable", reason };
  }
}

/** The Run in a saved string; throws `SaveFormatError` (or `RunStateError`) if it can't be used. */
export function parseSave(raw: string): RunState {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SaveFormatError("not JSON");
  }
  const save = record(value, "save");
  if (save.version !== SAVE_VERSION) {
    throw new SaveFormatError(
      `save version ${String(save.version)}, expected ${String(SAVE_VERSION)}`,
    );
  }
  const run = record(save.run, "run");
  const state: RunState = {
    ...snapshot(run, "run"),
    seed: count(run.seed, "seed"),
    lives: count(run.lives, "lives"),
    score: count(run.score, "score"),
    bestScore: count(run.bestScore, "bestScore"),
    phase: phase(run.phase),
    roundStart: snapshot(record(run.roundStart, "roundStart"), "roundStart"),
    crate: run.crate === null ? null : crate(run.crate),
    freeItem: run.freeItem === null ? null : freeItem(run.freeItem),
    sliderInputs: list(run.sliderInputs, "sliderInputs").map(sliderInput),
  };
  // A Piece that no longer fits the Maze (say, after a rule change) makes the save unusable.
  mazeOf(state.pieces);
  mazeOf(state.roundStart.pieces);
  return state;
}

const PHASES: readonly RunPhase[] = [
  "building",
  "fighting",
  "round-won",
  "round-lost",
  "run-over",
];

function phase(value: unknown): RunPhase {
  const found = PHASES.find((known) => known === value);
  if (found === undefined) throw new SaveFormatError("unknown phase");
  return found;
}

function snapshot(
  value: Readonly<Record<string, unknown>>,
  name: string,
): RoundSnapshot {
  return {
    pieces: list(value.pieces, `${name}.pieces`).map(placedPiece),
    army: list(value.army, `${name}.army`).map(placedDude) satisfies Army,
    mutations: list(value.mutations, `${name}.mutations`).map(mutationId),
    wallets: wallets(value.wallets),
    sliders: sliders(value.sliders),
  };
}

function sliders(value: unknown): SliderPositions {
  const found = record(value, "sliders");
  return {
    brightness: sliderPosition(found.brightness),
    // Saves from before the Volume trick have no Volume slider: it stood in the middle.
    volume: found.volume === undefined ? 0 : sliderPosition(found.volume),
    "game-speed": sliderPosition(found["game-speed"]),
  };
}

function sliderInput(value: unknown): SliderInput {
  const input = record(value, "slider input");
  return {
    step: count(input.step, "slider input step"),
    slider: sliderId(input.slider),
    position: sliderPosition(input.position),
  };
}

function sliderId(value: unknown): SliderId {
  const found = SLIDER_IDS.find((known) => known === value);
  if (found === undefined) throw new SaveFormatError("unknown slider");
  return found;
}

function sliderPosition(value: unknown): number {
  if (typeof value !== "number" || !isSliderPosition(value)) {
    throw new SaveFormatError("slider position is off the slider");
  }
  return value;
}

function placedPiece(value: unknown): PlacedPiece {
  const piece = record(value, "piece");
  return { pieceId: pieceId(piece.pieceId), tile: tile(piece.tile) };
}

function tile(value: unknown): Tile {
  const found = record(value, "tile");
  return {
    column: count(found.column, "column"),
    row: count(found.row, "row"),
  };
}

function placedDude(value: unknown): PlacedDude {
  const found = record(value, "placed Dude");
  const at = record(found.at, "spot");
  const spot = { x: coordinate(at.x), y: coordinate(at.y) };
  if (!isSpawnZonePoint(spot)) {
    throw new SaveFormatError("Dude outside the Spawn zone");
  }
  return {
    dudeKind: dudeKind(found.dudeKind),
    at: spot,
    stroke: count(found.stroke, "stroke"),
    round: count(found.round, "round painted"),
  };
}

function coordinate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SaveFormatError("spot is not a number");
  }
  return value;
}

function crate(value: unknown): Crate {
  const found = record(value, "crate");
  return {
    items: list(found.items, "crate.items").map(crateItem),
    rerolls: count(found.rerolls, "rerolls"),
  };
}

function crateItem(value: unknown): CrateItem {
  const item = record(value, "crate item");
  if (item.kind === "mutation") {
    return { kind: "mutation", id: mutationId(item.id) };
  }
  if (item.kind === "gift") return { kind: "gift", id: dudeKind(item.id) };
  if (item.kind === "piece") return { kind: "piece", id: pieceId(item.id) };
  throw new SaveFormatError("unknown crate item");
}

function freeItem(value: unknown): FreeItem {
  const item = record(value, "free item");
  if (item.kind === "piece") return { kind: "piece", id: pieceId(item.id) };
  if (item.kind === "gift") {
    return {
      kind: "gift",
      id: dudeKind(item.id),
      left: count(item.left, "gift left"),
    };
  }
  throw new SaveFormatError("unknown crate item");
}

function mutationId(value: unknown): MutationId {
  if (typeof value === "string" && Object.hasOwn(MUTATIONS, value)) {
    return value as MutationId;
  }
  throw new SaveFormatError("unknown Mutation");
}

function wallets(value: unknown): Wallets {
  const found = record(value, "wallets");
  return {
    defense: count(found.defense, "defense gold"),
    attack: count(found.attack, "attack gold"),
  };
}

function pieceId(value: unknown): PieceId {
  if (typeof value === "string" && Object.hasOwn(PIECES, value)) {
    return value as PieceId;
  }
  throw new SaveFormatError("unknown Piece");
}

function dudeKind(value: unknown): DudeKindId {
  if (typeof value === "string" && Object.hasOwn(DUDE_KINDS, value)) {
    return value as DudeKindId;
  }
  throw new SaveFormatError("unknown Dude kind");
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SaveFormatError(`${name} is not an object`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new SaveFormatError(`${name} is not a list`);
  return value as readonly unknown[];
}

/** A whole number of zero or more: gold, Lives, Score, seeds and tiles all are. */
function count(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new SaveFormatError(`${name} is not a whole number`);
  }
  return value;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
}
