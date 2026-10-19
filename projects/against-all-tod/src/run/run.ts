import type { Army, Squad } from "../battle/army";
import type { BattleSetup, Side } from "../battle/battle";
import { BATTLE_RULES, type BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS, ROUND_ONE_ARMY, type DudeKindId } from "../catalog/dudes";
import { GOLD_RULES } from "../catalog/gold-rules";
import type { MutationId } from "../catalog/mutations";
import { PIECES, type PieceId } from "../catalog/pieces";
import { CRATE_RULES, type CrateItem } from "../catalog/pools";
import { RUN_RULES } from "../catalog/run-rules";
import type { SliderId } from "../catalog/tricks";
import {
  addGold,
  spend,
  startingWallets,
  type Wallets,
} from "../economy/economy";
import { isOnBoard, tileKey, tileKind, type Tile } from "../maze/board";
import {
  emptyMaze,
  placePiece,
  type Maze,
  type PlacedPiece,
  type PlacementRefusal,
} from "../maze/maze";
import {
  dragPrice,
  NEUTRAL_SLIDERS,
  slidersAfter,
  type SliderInput,
  type SliderPositions,
} from "../tricks/tricks";
import { crateFor, sameItem, type Crate } from "./crate";

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

/** The Board, the Army, its Mutations, both wallets and the sliders: everything a Rewind puts back. */
export interface RoundSnapshot {
  readonly pieces: readonly PlacedPiece[];
  readonly army: Army;
  /** Stored as picked; ticket 15 gives them battle effects. */
  readonly mutations: readonly MutationId[];
  readonly wallets: Wallets;
  /** Where the Settings sliders stand; during a battle, where they stood as it started. */
  readonly sliders: SliderPositions;
}

/** A Piece or Squad taken from a crate, waiting to be placed for free. */
export type FreeItem = Extract<CrateItem, { kind: "piece" | "squad" }>;

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
  /** This Round's Draft Crate; null once an item is taken. */
  readonly crate: Crate | null;
  readonly freeItem: FreeItem | null;
  /** Sliders dragged during the battle being fought, in step order; empty between battles. */
  readonly sliderInputs: readonly SliderInput[];
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
  | { readonly type: "take-from-crate"; readonly index: number }
  | { readonly type: "reroll-crate" }
  | {
      readonly type: "drag-slider";
      readonly slider: SliderId;
      /** The position dragged to, -2 to 2. */
      readonly to: number;
      /** During a battle, the step the drag takes effect from; ignored between battles. */
      readonly atStep: number;
    }
  | { readonly type: "start-battle" }
  | {
      readonly type: "battle-finished";
      readonly winner: Side;
      /** What the battle earned each side (see economy); kept only if the Round is won. */
      readonly earned: Wallets;
      /** Tiles of the Pieces Wall-breakers destroyed; they stay gone only if the Round is won. */
      readonly destroyed: readonly Tile[];
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
  | "not-spawn-line"
  /** The crate is already taken from, or has no such item. */
  | "no-crate"
  /** A slider dragged off its end, or not moved at all. */
  | "slider-end";

export type RunResult =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly refusal: RunRefusal };

export function newRun(seed: number, bestScore = 0): RunState {
  const board: RoundSnapshot = {
    pieces: [],
    army: ROUND_ONE_ARMY,
    mutations: [],
    wallets: startingWallets(),
    sliders: NEUTRAL_SLIDERS,
  };
  return withFreshCrate({
    ...board,
    seed: seed >>> 0,
    lives: RUN_RULES.startingLives,
    score: 0,
    bestScore,
    phase: "building",
    roundStart: board,
    crate: null,
    freeItem: null,
    sliderInputs: [],
  });
}

/** The Round's crate as it first opens, with no free item waiting. */
export function withFreshCrate(state: RunState): RunState {
  return { ...state, crate: crateOf(state, 0), freeItem: null };
}

function crateOf(state: RunState, rerolls: number): Crate {
  return crateFor(
    roundSeed(state.seed, roundOf(state)),
    sideOf(state),
    state.mutations,
    rerolls,
  );
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

/** What a Piece costs in Defense gold from the shop. */
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
    mutations: state.mutations,
    seed: roundSeed(state.seed, roundOf(state)),
    rules,
    sliders: state.sliders,
    sliderInputs: state.sliderInputs,
  };
}

/** Null when a Squad may go on `tile` now; otherwise why not. Only Spawn line tiles take Squads. */
export function checkSquad(
  state: RunState,
  tile: Tile,
  dudeKind: DudeKindId,
): RunRefusal | null {
  const refusal = checkPlacing(
    state,
    "attack",
    priceNow(state, { kind: "squad", id: dudeKind }),
  );
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
      const item: FreeItem = { kind: "squad", id: action.dudeKind };
      return accept({
        ...usedFreeItem(state, item),
        army: [...state.army, squad],
        wallets: paid(state.wallets, "attack", priceNow(state, item)),
      });
    }
    case "take-from-crate":
      return takeFromCrate(state, action.index);
    case "reroll-crate": {
      if (state.phase !== "building") return refuse("wrong-phase");
      if (state.crate === null) return refuse("no-crate");
      const side = sideOf(state);
      const left = spend(state.wallets, side, CRATE_RULES.rerollPrice[side]);
      if (left === null) return refuse("not-enough-gold");
      return accept({
        ...state,
        wallets: left,
        crate: crateOf(state, state.crate.rerolls + 1),
      });
    }
    case "drag-slider":
      return dragSlider(state, action.slider, action.to, action.atStep);
    case "start-battle":
      if (state.phase !== "building") return refuse("wrong-phase");
      return accept({ ...state, phase: "fighting" });
    case "battle-finished":
      if (state.phase !== "fighting") return refuse("wrong-phase");
      return accept(
        action.winner === sideOf(state)
          ? winRound(state, action.earned, action.destroyed)
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
  const item: FreeItem = { kind: "piece", id: pieceId };
  const price = priceNow(state, item);
  const refusal = checkPlacing(state, "defense", price);
  if (refusal !== null) return refuse(refusal);
  const placed = placePiece(mazeOf(state.pieces), tile, pieceId);
  if (!placed.ok) return refuse(placed.refusal);
  return accept({
    ...usedFreeItem(state, item),
    pieces: [...state.pieces, { pieceId, tile }],
    wallets: paid(state.wallets, "defense", price),
  });
}

/** The taken item is free; the rest of the crate is gone. A Mutation joins the Army at once. */
function takeFromCrate(state: RunState, index: number): RunResult {
  if (state.phase !== "building") return refuse("wrong-phase");
  const item = state.crate?.items[index];
  if (item === undefined) return refuse("no-crate");
  const taken = { ...state, crate: null };
  if (item.kind === "mutation") {
    return accept({ ...taken, mutations: [...state.mutations, item.id] });
  }
  return accept({ ...taken, freeItem: item });
}

/** Where the sliders stand now, mid-battle drags included. */
export function currentSliders(state: RunState): SliderPositions {
  return slidersAfter(state.sliders, state.sliderInputs);
}

/** What dragging `slider` to `to` would cost the side being played now; null if it can't go there. */
export function sliderPriceNow(
  state: RunState,
  slider: SliderId,
  to: number,
): number | null {
  return dragPrice(
    slider,
    currentSliders(state)[slider],
    to,
    state.phase === "fighting",
  );
}

/**
 * The side being played pays. Between battles the slider simply moves; mid-battle the drag is
 * recorded as a timed input, so the battle replays the same from its seed.
 */
function dragSlider(
  state: RunState,
  slider: SliderId,
  to: number,
  atStep: number,
): RunResult {
  if (state.phase !== "building" && state.phase !== "fighting") {
    return refuse("wrong-phase");
  }
  const price = sliderPriceNow(state, slider, to);
  if (price === null) return refuse("slider-end");
  const wallets = spend(state.wallets, sideOf(state), price);
  if (wallets === null) return refuse("not-enough-gold");
  if (state.phase === "building") {
    return accept({
      ...state,
      wallets,
      sliders: { ...state.sliders, [slider]: to },
    });
  }
  // Inputs stay in step order even if a caller reports an earlier step than the last drag's.
  const step = Math.max(atStep, state.sliderInputs.at(-1)?.step ?? 0);
  return accept({
    ...state,
    wallets,
    sliderInputs: [...state.sliderInputs, { step, slider, position: to }],
  });
}

/** Zero for the waiting free item, otherwise the shop price. */
export function priceNow(state: RunState, item: FreeItem): number {
  if (state.freeItem !== null && sameItem(state.freeItem, item)) return 0;
  return item.kind === "piece" ? piecePrice(item.id) : squadPrice(item.id);
}

function usedFreeItem(state: RunState, placed: FreeItem): RunState {
  if (state.freeItem === null || !sameItem(state.freeItem, placed)) {
    return state;
  }
  return { ...state, freeItem: null };
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

/** Everything placed and earned stays, less what Wall-breakers destroyed, and the next Round starts from here. */
function winRound(
  state: RunState,
  earned: Wallets,
  destroyed: readonly Tile[],
): RunState {
  const wallets = addGold(state.wallets, earned);
  const sliders = currentSliders(state);
  const gone = new Set(destroyed.map(tileKey));
  const pieces =
    gone.size === 0
      ? state.pieces
      : state.pieces.filter(({ tile }) => !gone.has(tileKey(tile)));
  return withFreshCrate({
    ...state,
    pieces,
    wallets,
    sliders,
    sliderInputs: [],
    score: state.score + 1,
    phase: "round-won",
    roundStart: {
      pieces,
      army: state.army,
      mutations: state.mutations,
      wallets,
      sliders,
    },
  });
}

/**
 * One Life gone and the Board and wallets Rewound, with bonus gold for the side played. The
 * Round number stays, because the Score does, so the same crate opens again.
 */
function loseRound(state: RunState): RunState {
  const lives = state.lives - 1;
  const side = sideOf(state);
  const wallets = {
    ...state.roundStart.wallets,
    [side]: state.roundStart.wallets[side] + GOLD_RULES.rewindBonus,
  };
  const rewound = withFreshCrate({
    ...state,
    ...state.roundStart,
    wallets,
    sliderInputs: [],
    lives,
    roundStart: { ...state.roundStart, wallets },
  });
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
