import type { Army, Squad } from "../../battle/army";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import { PIECES, type PieceId } from "../../catalog/pieces";
import type { Wallets } from "../../economy/economy";
import type { Logger } from "../../logger";
import type { PlacedPiece } from "../../maze/maze";
import {
  mazeOf,
  type RoundSnapshot,
  type RunPhase,
  type RunState,
} from "../../run/run";

/**
 * Saves the Run to browser storage and loads it back. A save that can't be read, or comes from
 * another save version, is dropped for a fresh start: a warning is logged and the caller shows a
 * message, never a crash.
 */

/** Bump when the saved shape changes; older saves then give a fresh start. */
export const SAVE_VERSION = 1;
export const SAVE_KEY = "against-all-tod.save";

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
    army: list(value.army, `${name}.army`).map(squad) satisfies Army,
    wallets: wallets(value.wallets),
  };
}

function placedPiece(value: unknown): PlacedPiece {
  const piece = record(value, "piece");
  const tile = record(piece.tile, "piece.tile");
  return {
    pieceId: pieceId(piece.pieceId),
    tile: { column: count(tile.column, "column"), row: count(tile.row, "row") },
  };
}

function squad(value: unknown): Squad {
  const found = record(value, "squad");
  return {
    dudeKind: dudeKind(found.dudeKind),
    spawnRow: count(found.spawnRow, "spawnRow"),
  };
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
