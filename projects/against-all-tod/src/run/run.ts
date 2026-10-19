import {
  hasRoom,
  isSpawnZonePoint,
  roundOneArmy,
  squeezeArmy,
  type Army,
  type PlacedDude,
} from "../battle/army";
import type { BattleSetup, Side } from "../battle/battle";
import { earthquake } from "../battle/curses";
import type { BoardPoint } from "../battle/events";
import { BATTLE_RULES, type BattleRules } from "../catalog/battle-rules";
import type { BossId } from "../catalog/bosses";
import { CURSE_IDS, CURSE_RULES, type CurseId } from "../catalog/curses";
import {
  DUDE_KINDS,
  DUDE_KINDS_ON_SALE,
  paintRadius,
  type DudeKindId,
} from "../catalog/dudes";
import { GOLD_RULES } from "../catalog/gold-rules";
import type { MutationId } from "../catalog/mutations";
import { PIECES, type PieceId } from "../catalog/pieces";
import { CRATE_RULES, type CrateItem } from "../catalog/pools";
import { RUN_RULES } from "../catalog/run-rules";
import { SLIDERS, type SliderId } from "../catalog/tricks";
import {
  addGold,
  spend,
  startingWallets,
  type Wallets,
} from "../economy/economy";
import { tileKey, type Tile } from "../maze/board";
import { createRng } from "../rng/rng";
import {
  emptyMaze,
  placePiece,
  resizeMaze,
  type Maze,
  type PlacedPiece,
  type PlacementRefusal,
} from "../maze/maze";
import {
  dragPrice,
  NEUTRAL_SLIDERS,
  slidersAfter,
  undoPrice,
  type SliderInput,
  type SliderPositions,
} from "../tricks/tricks";
import { bossFor, opensBossCrate } from "./boss-rounds";
import { crateFor, type Crate, type CrateKind } from "./crate";

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

/**
 * The Board, the Army, its Mutations, both wallets, the sliders and the free Undos held:
 * everything a Rewind puts back.
 */
export interface RoundSnapshot {
  readonly pieces: readonly PlacedPiece[];
  readonly army: Army;
  /** Stored as picked; ticket 15 gives them battle effects. */
  readonly mutations: readonly MutationId[];
  readonly wallets: Wallets;
  /** Where the Settings sliders stand; during a battle, where they stood as it started. */
  readonly sliders: SliderPositions;
  /** Undos the player holds that skip the payment (boss crates give them). */
  readonly freeUndos: number;
}

/**
 * Taken from a crate and waiting to be placed for free: a Piece, or a gift of Dudes of one kind
 * with `left` still to paint. Lost if the Round ends first.
 */
export type FreeItem =
  | Extract<CrateItem, { kind: "piece" }>
  | {
      readonly kind: "gift";
      readonly id: DudeKindId;
      readonly left: number;
    };

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
  /** This Round's Draft Crate; null once its picks are taken. */
  readonly crate: Crate | null;
  /** What the crate gave that waits to be placed, in the order taken; at most one gift per kind. */
  readonly freeItems: readonly FreeItem[];
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
      readonly type: "paint-dude";
      readonly dudeKind: DudeKindId;
      /** In tiles; only spots in the Spawn zone with room around them are accepted. */
      readonly at: BoardPoint;
      /** The drag it is painted in; see `nextStroke`. */
      readonly stroke: number;
    }
  | {
      /** Erases a Dude painted this Round for a refund, or Dismisses an older one for nothing. */
      readonly type: "erase-dude";
      /** Its place in the Army. */
      readonly index: number;
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
  | {
      /**
       * Snaps `slider` back to the middle. The side being played destroys its own Pieces (Defense)
       * or Dudes (Attack) worth at least the Undo price; a free Undo destroys nothing.
       */
      readonly type: "undo";
      readonly slider: SliderId;
      /** Tiles of the Pieces to destroy, on a Defense turn. */
      readonly pieces: readonly Tile[];
      /** Places in the Army of the Dudes to destroy, on an Attack turn. */
      readonly dudes: readonly number[];
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
  /** Placing a Piece on an Attack turn, or painting a Dude on a Defense turn. */
  | "wrong-side"
  /** The side's own wallet can't pay for it. */
  | "not-enough-gold"
  /** A Dude painted anywhere outside the Spawn zone. */
  | "not-spawn-zone"
  /** A Dude painted too close to another. */
  | "no-room"
  /** A Dude kind the shop doesn't sell and no gift holds. */
  | "not-on-sale"
  /** Erasing a Dude the Army doesn't have. */
  | "no-dude"
  /** The crate is already taken from, or has no such item. */
  | "no-crate"
  /** A slider dragged off its end, or not moved at all. */
  | "slider-end"
  /** Undoing a slider that already stands in the middle. */
  | "nothing-to-undo"
  /** Picking for an Undo a Piece that isn't there. */
  | "no-piece"
  /** The Pieces or Dudes picked for an Undo are worth less than its price. */
  | "undo-short";

export type RunResult =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly refusal: RunRefusal };

export function newRun(seed: number, bestScore = 0): RunState {
  const board: RoundSnapshot = {
    pieces: [],
    army: roundOneArmy(seed >>> 0),
    mutations: [],
    wallets: startingWallets(),
    sliders: NEUTRAL_SLIDERS,
    freeUndos: 0,
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
    freeItems: [],
    sliderInputs: [],
  });
}

/** The Round's crate as it first opens, with no free item waiting. */
export function withFreshCrate(state: RunState): RunState {
  return { ...state, crate: crateOf(state, 0), freeItems: [] };
}

function crateOf(
  state: RunState,
  rerolls: number,
  kind: CrateKind = opensBossCrate(roundOf(state)) ? "boss" : "draft",
): Crate {
  return crateFor(
    roundSeed(state.seed, roundOf(state)),
    sideOf(state),
    state.mutations,
    rerolls,
    kind,
  );
}

/** The boss that fights against the player this Round; null outside Boss Rounds. */
export function bossOf(state: RunState): BossId | null {
  return bossFor(roundOf(state), sideOf(state));
}

/** Where the player stands, for the HUD and the logs. */
export interface RunStatus {
  readonly round: number;
  readonly side: Side;
  readonly lives: number;
  readonly score: number;
  readonly wallets: Wallets;
  readonly curse: CurseId | null;
  readonly boss: BossId | null;
}

export function runStatusOf(state: RunState): RunStatus {
  return {
    round: roundOf(state),
    side: sideOf(state),
    lives: state.lives,
    score: state.score,
    wallets: state.wallets,
    curse: curseOf(state),
    boss: bossOf(state),
  };
}

/**
 * The Round's Curse, rolled from the Round's seed, so a Rewound Round keeps the same one. Worked
 * out rather than stored, so a save needs nothing new. Null before the first cursed Round.
 */
export function curseOf(state: RunState): CurseId | null {
  const round = roundOf(state);
  if (round < CURSE_RULES.firstCursedRound) return null;
  // Its own stream off the Round's seed, so the roll doesn't follow the crate's or the battle's.
  const rng = createRng((roundSeed(state.seed, round) ^ 0xc0_75e5) >>> 0);
  return CURSE_IDS[Math.floor(rng() * CURSE_IDS.length)] ?? null;
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

/** What one painted Dude costs in Attack gold. */
export function dudePrice(dudeKind: DudeKindId): number {
  return DUDE_KINDS[dudeKind].dudePrice;
}

/** The Maze built from the placed Pieces, in the order they went down, at a Window size. */
export function mazeOf(
  pieces: readonly PlacedPiece[],
  windowSize: number,
): Maze {
  return pieces.reduce((maze, { pieceId, tile }) => {
    const placed = placePiece(maze, tile, pieceId);
    if (!placed.ok) {
      throw new RunStateError(
        `${pieceId} at (${String(tile.column)}, ${String(tile.row)}) no longer fits the Maze: ${placed.refusal}`,
      );
    }
    return placed.maze;
  }, emptyMaze(windowSize));
}

/** Where the Window size slider stands: it is never dragged mid-battle, so `sliders` has it. */
export function windowSizeOf(state: RoundSnapshot): number {
  return state.sliders["window-size"];
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
    maze: mazeOf(state.pieces, windowSizeOf(state)),
    army: state.army,
    mutations: state.mutations,
    seed: roundSeed(state.seed, roundOf(state)),
    rules,
    sliders: state.sliders,
    sliderInputs: state.sliderInputs,
    curse: curseOf(state),
    boss: bossOf(state),
  };
}

/** Null when a Dude of `dudeKind` may be painted at `at` now; otherwise why not. */
export function checkPaint(
  state: RunState,
  at: BoardPoint,
  dudeKind: DudeKindId,
): RunRefusal | null {
  if (state.phase !== "building") return "wrong-phase";
  if (sideOf(state) !== "attack") return "wrong-side";
  if (!canPaintKind(state, dudeKind)) return "not-on-sale";
  if (!isSpawnZonePoint(at, windowSizeOf(state))) return "not-spawn-zone";
  if (!hasRoom(state.army, dudeKind, at)) return "no-room";
  return checkPlacing(state, "attack", dudePriceNow(state, dudeKind));
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
    case "paint-dude":
      return paintDude(state, action.dudeKind, action.at, action.stroke);
    case "erase-dude":
      return eraseDude(state, action.index);
    case "take-from-crate":
      return takeFromCrate(state, action.index);
    case "reroll-crate": {
      if (state.phase !== "building") return refuse("wrong-phase");
      if (state.crate === null) return refuse("no-crate");
      const side = sideOf(state);
      const left = spend(state.wallets, side, CRATE_RULES.rerollPrice[side]);
      if (left === null) return refuse("not-enough-gold");
      // A boss crate rerolled after a pick keeps its kind and only the picks it has left.
      return accept({
        ...state,
        wallets: left,
        crate: {
          ...crateOf(state, state.crate.rerolls + 1, state.crate.kind),
          picks: state.crate.picks,
        },
      });
    }
    case "drag-slider":
      return dragSlider(state, action.slider, action.to, action.atStep);
    case "undo":
      return undo(state, action.slider, action.pieces, action.dudes);
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
  const price = piecePriceNow(state, pieceId);
  const refusal = checkPlacing(state, "defense", price);
  if (refusal !== null) return refuse(refusal);
  const placed = placePiece(
    mazeOf(state.pieces, windowSizeOf(state)),
    tile,
    pieceId,
  );
  if (!placed.ok) return refuse(placed.refusal);
  const freeAt = state.freeItems.findIndex(
    (item) => item.kind === "piece" && item.id === pieceId,
  );
  return accept({
    ...state,
    freeItems: state.freeItems.filter((_, index) => index !== freeAt),
    pieces: [...state.pieces, { pieceId, tile }],
    wallets: paid(state.wallets, "defense", price),
  });
}

/** Paints one Dude, from the gift while it lasts, then for gold. */
function paintDude(
  state: RunState,
  dudeKind: DudeKindId,
  at: BoardPoint,
  stroke: number,
): RunResult {
  const refusal = checkPaint(state, at, dudeKind);
  if (refusal !== null) return refuse(refusal);
  const dude: PlacedDude = { dudeKind, at, stroke, round: roundOf(state) };
  const left = giftLeft(state, dudeKind);
  if (left > 0) {
    return accept({
      ...state,
      army: [...state.army, { ...dude, fromGift: true }],
      freeItems: withGift(state.freeItems, dudeKind, left - 1),
    });
  }
  return accept({
    ...state,
    army: [...state.army, dude],
    wallets: paid(state.wallets, "attack", dudePrice(dudeKind)),
  });
}

/**
 * Removes one Dude. Painted this Round, it is Erased: its price goes back to Attack gold, or to
 * the gift if it came from one. Older, it is Dismissed: nothing comes back.
 */
function eraseDude(state: RunState, index: number): RunResult {
  if (state.phase !== "building") return refuse("wrong-phase");
  if (sideOf(state) !== "attack") return refuse("wrong-side");
  const dude = state.army[index];
  if (dude === undefined) return refuse("no-dude");
  const erased = {
    ...state,
    army: state.army.filter((_, at) => at !== index),
  };
  if (dude.round !== roundOf(state)) return accept(erased);
  if (dude.fromGift === true) {
    const left = giftLeft(state, dude.dudeKind) + 1;
    return accept({
      ...erased,
      freeItems: withGift(state.freeItems, dude.dudeKind, left),
    });
  }
  return accept({
    ...erased,
    wallets: {
      ...state.wallets,
      attack: state.wallets.attack + dudePrice(dude.dudeKind),
    },
  });
}

/**
 * The taken item is free. The crate stays open, less that item, while it has picks left; then
 * the rest is gone. A Mutation joins the Army and a free Undo is held at once.
 */
function takeFromCrate(state: RunState, index: number): RunResult {
  if (state.phase !== "building") return refuse("wrong-phase");
  const crate = state.crate;
  const item = crate?.items[index];
  if (crate === null || item === undefined) return refuse("no-crate");
  const picks = crate.picks - 1;
  const taken: RunState = {
    ...state,
    crate:
      picks === 0
        ? null
        : {
            ...crate,
            items: crate.items.filter((_, at) => at !== index),
            picks,
          },
  };
  switch (item.kind) {
    case "mutation":
      return accept({ ...taken, mutations: [...state.mutations, item.id] });
    case "free-undo":
      return accept({
        ...taken,
        crate:
          taken.crate === null
            ? null
            : { ...taken.crate, kind: "boss-undo-taken" },
        freeUndos: state.freeUndos + 1,
      });
    case "gift": {
      const left = giftLeft(state, item.id) + DUDE_KINDS[item.id].giftSize;
      return accept({
        ...taken,
        freeItems: withGift(state.freeItems, item.id, left),
      });
    }
    case "piece":
      return accept({ ...taken, freeItems: [...state.freeItems, item] });
  }
}

/** The free items with the gift of `dudeKind` holding `left`: added, changed, or gone at zero. */
function withGift(
  items: readonly FreeItem[],
  dudeKind: DudeKindId,
  left: number,
): FreeItem[] {
  const isThisGift = (item: FreeItem) =>
    item.kind === "gift" && item.id === dudeKind;
  if (left === 0) return items.filter((item) => !isThisGift(item));
  const gift: FreeItem = { kind: "gift", id: dudeKind, left };
  return items.some(isThisGift)
    ? items.map((item) => (isThisGift(item) ? gift : item))
    : [...items, gift];
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

/** Whether `slider` can be dragged in the Run's phase: between battles, or mid-battle if it allows. */
function canDragNow(state: RunState, slider: SliderId): boolean {
  return (
    state.phase === "building" ||
    (state.phase === "fighting" && SLIDERS[slider].midBattle)
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
  if (!canDragNow(state, slider)) return refuse("wrong-phase");
  const price = sliderPriceNow(state, slider, to);
  if (price === null) return refuse("slider-end");
  const wallets = spend(state.wallets, sideOf(state), price);
  if (wallets === null) return refuse("not-enough-gold");
  if (slider === "window-size") {
    return resizeWindow({ ...state, wallets }, to);
  }
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

/**
 * Window size between battles: Pieces on a lane that closes are crushed, and Dudes in Spawn zone
 * rows that close are squeezed into the nearest open row. Refused if the Goal would be cut off.
 */
function resizeWindow(state: RunState, windowSize: number): RunResult {
  const resized = resizeMaze(
    mazeOf(state.pieces, windowSizeOf(state)),
    windowSize,
  );
  if (!resized.ok) return refuse(resized.refusal);
  const crushed = new Set(resized.crushed.map(({ tile }) => tileKey(tile)));
  return accept({
    ...state,
    sliders: { ...state.sliders, "window-size": windowSize },
    pieces:
      crushed.size === 0
        ? state.pieces
        : state.pieces.filter(({ tile }) => !crushed.has(tileKey(tile))),
    army: squeezeArmy(state.army, windowSize),
  });
}

/** What Undoing `slider` costs now, in Pieces or Dudes; zero with a free Undo. */
export function undoPriceNow(state: RunState, slider: SliderId): number {
  return state.freeUndos > 0 ? 0 : undoPrice(slider, state.sliders[slider]);
}

/** What the picked Pieces or Dudes count toward an Undo: each its shop price, nothing refunded. */
export function undoValue(
  state: RunState,
  pieces: readonly Tile[],
  dudes: readonly number[],
): number {
  const picked = new Set(pieces.map(tileKey));
  const pieceValue = state.pieces
    .filter(({ tile }) => picked.has(tileKey(tile)))
    .reduce((sum, { pieceId }) => sum + piecePrice(pieceId), 0);
  const dudeValue = state.army
    .filter((_, index) => dudes.includes(index))
    .reduce((sum, { dudeKind }) => sum + dudePrice(dudeKind), 0);
  return pieceValue + dudeValue;
}

/**
 * Only between battles: Window size can't move mid-battle, and picking Pieces or Dudes needs the
 * Board still. Window size snaps back through the same resize a drag does, so Pieces on a lane
 * that closes are crushed and Dudes squeezed.
 */
function undo(
  state: RunState,
  slider: SliderId,
  pieces: readonly Tile[],
  dudes: readonly number[],
): RunResult {
  if (state.phase !== "building") return refuse("wrong-phase");
  if (state.sliders[slider] === 0) return refuse("nothing-to-undo");
  const side = sideOf(state);
  if (side === "attack" ? pieces.length > 0 : dudes.length > 0) {
    return refuse("wrong-side");
  }
  const tiles = new Set(state.pieces.map(({ tile }) => tileKey(tile)));
  if (pieces.some((tile) => !tiles.has(tileKey(tile)))) {
    return refuse("no-piece");
  }
  if (dudes.some((index) => state.army[index] === undefined)) {
    return refuse("no-dude");
  }
  const free = state.freeUndos > 0;
  if (!free && undoValue(state, pieces, dudes) < undoPriceNow(state, slider)) {
    return refuse("undo-short");
  }
  const gone = new Set(free ? [] : pieces.map(tileKey));
  const paid: RunState = free
    ? { ...state, freeUndos: state.freeUndos - 1 }
    : {
        ...state,
        pieces: state.pieces.filter(({ tile }) => !gone.has(tileKey(tile))),
        army: state.army.filter((_, index) => !dudes.includes(index)),
      };
  if (slider === "window-size") return resizeWindow(paid, 0);
  return accept({ ...paid, sliders: { ...paid.sliders, [slider]: 0 } });
}

/** Zero for the waiting free Piece, otherwise the shop price. */
export function piecePriceNow(state: RunState, pieceId: PieceId): number {
  const free = state.freeItems.some(
    (item) => item.kind === "piece" && item.id === pieceId,
  );
  return free ? 0 : piecePrice(pieceId);
}

/** Zero while the crate gift has Dudes of this kind left, otherwise the price per Dude. */
export function dudePriceNow(state: RunState, dudeKind: DudeKindId): number {
  return giftLeft(state, dudeKind) > 0 ? 0 : dudePrice(dudeKind);
}

/** Whether `dudeKind` can be painted at all now: the shop sells it, or the gift still holds some. */
export function canPaintKind(state: RunState, dudeKind: DudeKindId): boolean {
  return DUDE_KINDS_ON_SALE.includes(dudeKind) || giftLeft(state, dudeKind) > 0;
}

/**
 * Where in the Army each Dude under the eraser at `at` stands. The eraser reaches twice a Dude's
 * painting room, the spacing painting keeps, so a drag through a crowd misses none.
 */
export function dudesUnder(army: Army, at: BoardPoint): number[] {
  return army.flatMap((dude, index) => {
    const radius = 2 * paintRadius(dude.dudeKind);
    const dx = dude.at.x - at.x;
    const dy = dude.at.y - at.y;
    return dx * dx + dy * dy < radius * radius ? [index] : [];
  });
}

/** Free Dudes of `dudeKind` the crate gift still holds. */
export function giftLeft(state: RunState, dudeKind: DudeKindId): number {
  for (const item of state.freeItems) {
    if (item.kind === "gift" && item.id === dudeKind) return item.left;
  }
  return 0;
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
  const gone = new Set(boardTiles(state, destroyed).map(tileKey));
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
      freeUndos: state.freeUndos,
    },
  });
}

/**
 * Where the destroyed Pieces stand on the Board. An Earthquake moved one Piece for the battle
 * only, so a Piece destroyed on its shaken tile is the one from the tile it left.
 */
function boardTiles(state: RunState, destroyed: readonly Tile[]): Tile[] {
  if (curseOf(state) !== "earthquake" || destroyed.length === 0) {
    return [...destroyed];
  }
  const setup = battleSetupOf(state);
  const quake = earthquake(setup.maze, setup.seed);
  if (quake === null) return [...destroyed];
  const shaken = tileKey(quake.to);
  return destroyed.map((tile) =>
    tileKey(tile) === shaken ? quake.from : tile,
  );
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
