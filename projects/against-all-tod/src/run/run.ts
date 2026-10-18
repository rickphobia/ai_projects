import type { Army, Squad } from "../battle/army";
import type { BattleSetup, Side } from "../battle/battle";
import { BATTLE_RULES, type BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS, ROUND_ONE_ARMY, type DudeKindId } from "../catalog/dudes";
import { GOLD_RULES } from "../catalog/gold-rules";
import { PIECES, type PieceId } from "../catalog/pieces";
import { RUN_RULES } from "../catalog/run-rules";
import {
  addGold,
  spend,
  startingWallets,
  type Wallets,
} from "../economy/economy";
import { isOnBoard, tileKind, type Tile } from "../maze/board";
import {
  emptyMaze,
  placePiece,
  type Maze,
  type PlacedPiece,
  type PlacementRefusal,
} from "../maze/maze";

/**
 * The whole Run as a pure state machine: actions in, new state or a typed refusal out. No DOM,
 * PixiJS or battle stepping here; the caller runs the battle and reports who won.
 */

export type RunPhase =
  | "building"
  | "fighting"
  /** The battle is over and the player has seen nothing yet; `continue` starts the next Round. */
  | "round-won"
  | "round-lost"
  | "run-over";

/** The Board, the Army and both wallets: everything a Rewind puts back. */
export interface RoundSnapshot {
  readonly pieces: readonly PlacedPiece[];
  readonly army: Army;
  readonly wallets: Wallets;
}

/** Plain data only (no Maps or classes), so a save can JSON it as it is. */
export interface RunState extends RoundSnapshot {
  readonly seed: number;
  readonly lives: number;
  /** Rounds won. The Round being played is always one more. */
  readonly score: number;
  /** The best Score of this session, this Run included once it ends. */
  readonly bestScore: number;
  readonly phase: RunPhase;
  /** The Board, Army and wallets as the current Round began. */
  readonly roundStart: RoundSnapshot;
}

export type RunAction =
  | {
      readonly type: "place-piece";
      readonly tile: Tile;
      readonly pieceId: PieceId;
    }
  | {
      readonly type: "place-squad";
      /** Any tapped tile; only Spawn line tiles are accepted. */
      readonly tile: Tile;
      readonly dudeKind: DudeKindId;
    }
  | { readonly type: "start-battle" }
  | {
      readonly type: "battle-finished";
      readonly winner: Side;
      /** What the battle earned each side (see economy); kept only if the Round is won. */
      readonly earned: Wallets;
    }
  | { readonly type: "continue" }
  | { readonly type: "new-run" };

/** Why an action was refused: the Maze's own reasons, plus the Run's. */
export type RunRefusal =
  | PlacementRefusal
  /** The action doesn't fit the phase, such as placing during a battle. */
  | "wrong-phase"
  /** Placing a Piece on an Attack turn, or a Squad on a Defense turn. */
  | "wrong-side"
  /** The side's own wallet can't pay for it. */
  | "not-enough-gold"
  /** A Squad anywhere but the Spawn line. */
  | "not-spawn-line";

export type RunResult =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly refusal: RunRefusal };

export function newRun(seed: number, bestScore = 0): RunState {
  const board: RoundSnapshot = {
    pieces: [],
    army: ROUND_ONE_ARMY,
    wallets: startingWallets(),
  };
  return {
    ...board,
    seed: seed >>> 0,
    lives: RUN_RULES.startingLives,
    score: 0,
    bestScore,
    phase: "building",
    roundStart: board,
  };
}

/** Where the player stands, for the HUD and the logs. */
export interface RunStatus {
  readonly round: number;
  readonly side: Side;
  readonly lives: number;
  readonly score: number;
  readonly wallets: Wallets;
}

export function runStatusOf(state: RunState): RunStatus {
  return {
    round: roundOf(state),
    side: sideOf(state),
    lives: state.lives,
    score: state.score,
    wallets: state.wallets,
  };
}

export function roundOf(state: RunState): number {
  return state.score + 1;
}

/** The side the player plays this Round: odd Rounds defend, even Rounds attack. */
export function sideOf(state: RunState): Side {
  return roundOf(state) % 2 === 1 ? "defense" : "attack";
}

/** What a Piece costs in Defense gold. */
export function piecePrice(pieceId: PieceId): number {
  return PIECES[pieceId].price;
}

/** What a Squad costs in Attack gold. */
export function squadPrice(dudeKind: DudeKindId): number {
  return DUDE_KINDS[dudeKind].squadPrice;
}

/** The Maze built from the placed Pieces, in the order they went down. */
export function mazeOf(pieces: readonly PlacedPiece[]): Maze {
  return pieces.reduce((maze, { pieceId, tile }) => {
    const placed = placePiece(maze, tile, pieceId);
    if (!placed.ok) {
      throw new RunStateError(
        `${pieceId} at (${String(tile.column)}, ${String(tile.row)}) no longer fits the Maze: ${placed.refusal}`,
      );
    }
    return placed.maze;
  }, emptyMaze());
}

export class RunStateError extends Error {
  override name = "RunStateError";
}

/** The battle for the Round being played. A Rewound Round replays with the same seed. */
export function battleSetupOf(
  state: RunState,
  rules: BattleRules = BATTLE_RULES,
): BattleSetup {
  return {
    maze: mazeOf(state.pieces),
    army: state.army,
    seed: roundSeed(state.seed, roundOf(state)),
    rules,
  };
}

/** Null when a Squad may go on `tile` now; otherwise why not. Only Spawn line tiles take Squads. */
export function checkSquad(
  state: RunState,
  tile: Tile,
  dudeKind: DudeKindId,
): RunRefusal | null {
  const refusal = checkPlacing(state, "attack", squadPrice(dudeKind));
  if (refusal !== null) return refusal;
  if (!isOnBoard(tile)) return "off-board";
  if (tileKind(tile) !== "spawn-line") return "not-spawn-line";
  if (state.army.some((squad) => squad.spawnRow === tile.row)) {
    return "tile-taken";
  }
  return null;
}

/** Null when `pieceId` may go on `tile` now; otherwise why not. */
export function checkPiece(
  state: RunState,
  tile: Tile,
  pieceId: PieceId,
): RunRefusal | null {
  const result = placeOnMaze(state, tile, pieceId);
  return result.ok ? null : result.refusal;
}

export function applyRunAction(state: RunState, action: RunAction): RunResult {
  switch (action.type) {
    case "place-piece":
      return placeOnMaze(state, action.tile, action.pieceId);
    case "place-squad": {
      const refusal = checkSquad(state, action.tile, action.dudeKind);
      if (refusal !== null) return refuse(refusal);
      const squad: Squad = {
        dudeKind: action.dudeKind,
        spawnRow: action.tile.row,
      };
      return accept({
        ...state,
        army: [...state.army, squad],
        wallets: paid(state.wallets, "attack", squadPrice(action.dudeKind)),
      });
    }
    case "start-battle":
      if (state.phase !== "building") return refuse("wrong-phase");
      return accept({ ...state, phase: "fighting" });
    case "battle-finished":
      if (state.phase !== "fighting") return refuse("wrong-phase");
      return accept(
        action.winner === sideOf(state)
          ? winRound(state, action.earned)
          : loseRound(state),
      );
    case "continue":
      if (state.phase !== "round-won" && state.phase !== "round-lost") {
        return refuse("wrong-phase");
      }
      return accept({ ...state, phase: "building" });
    case "new-run":
      if (state.phase !== "run-over") return refuse("wrong-phase");
      return accept(newRun(state.seed + 1, state.bestScore));
  }
}

function placeOnMaze(state: RunState, tile: Tile, pieceId: PieceId): RunResult {
  const refusal = checkPlacing(state, "defense", piecePrice(pieceId));
  if (refusal !== null) return refuse(refusal);
  const placed = placePiece(mazeOf(state.pieces), tile, pieceId);
  if (!placed.ok) return refuse(placed.refusal);
  return accept({
    ...state,
    pieces: [...state.pieces, { pieceId, tile }],
    wallets: paid(state.wallets, "defense", piecePrice(pieceId)),
  });
}

function checkPlacing(
  state: RunState,
  side: Side,
  price: number,
): RunRefusal | null {
  if (state.phase !== "building") return "wrong-phase";
  if (sideOf(state) !== side) return "wrong-side";
  if (spend(state.wallets, side, price) === null) return "not-enough-gold";
  return null;
}

/** For a purchase `checkPlacing` has already allowed. */
function paid(wallets: Wallets, side: Side, price: number): Wallets {
  const left = spend(wallets, side, price);
  if (left === null) {
    throw new RunStateError(
      `${side} paid ${String(price)} gold it didn't have`,
    );
  }
  return left;
}

/** Everything placed and earned stays, and the next Round starts from here. */
function winRound(state: RunState, earned: Wallets): RunState {
  const wallets = addGold(state.wallets, earned);
  return {
    ...state,
    wallets,
    score: state.score + 1,
    phase: "round-won",
    roundStart: { pieces: state.pieces, army: state.army, wallets },
  };
}

/**
 * One Life gone and the Board and wallets Rewound, with bonus gold for the side played. The
 * Round number stays, because the Score does.
 */
function loseRound(state: RunState): RunState {
  const lives = state.lives - 1;
  const side = sideOf(state);
  const wallets = {
    ...state.roundStart.wallets,
    [side]: state.roundStart.wallets[side] + GOLD_RULES.rewindBonus,
  };
  const rewound = {
    ...state,
    ...state.roundStart,
    wallets,
    lives,
    roundStart: { ...state.roundStart, wallets },
  };
  if (lives > 0) return { ...rewound, phase: "round-lost" };
  return {
    ...rewound,
    phase: "run-over",
    bestScore: Math.max(state.bestScore, state.score),
  };
}

/** A different battle seed per Round, all from the Run's seed. */
function roundSeed(runSeed: number, round: number): number {
  return (runSeed + Math.imul(round, 0x9e3779b9)) >>> 0;
}

function accept(state: RunState): RunResult {
  return { ok: true, state };
}

function refuse(refusal: RunRefusal): RunResult {
  return { ok: false, refusal };
}
