import type { PlacedDude } from "../battle/army";
import type { DudeKindId } from "../catalog/dudes";
import type { PieceId } from "../catalog/pieces";
import type { CrateItem } from "../catalog/pools";
import type { SliderId } from "../catalog/tricks";
import type { PlacedPiece } from "../maze/maze";
import type { RunAction, RunState } from "./run";

/**
 * The Take back history: one entry per takeable action this Round, newest last, each holding
 * what the action changed so it can be reversed exactly. Entries store changes, not snapshots,
 * because a whole Army per Stroke would fill browser storage within a Round.
 */

/** The action an entry reverses, for the button's label and the logs. */
export type TakeBackAction =
  | { readonly kind: "place-piece"; readonly pieceId: PieceId }
  | {
      readonly kind: "stroke";
      readonly stroke: number;
      readonly dudeKind: DudeKindId;
      readonly dudes: number;
    }
  /** Erases and Dismisses alike. */
  | {
      readonly kind: "eraser-drag";
      readonly drag: number;
      readonly dudes: number;
    }
  | { readonly kind: "crate-pick"; readonly item: CrateItem }
  | { readonly kind: "slider"; readonly slider: SliderId };

/**
 * How one list changed: the places, after the change, of the items it added, and the items it
 * removed with their places before it. Items it kept stay in the same order, so this is enough
 * to put the list back.
 */
export interface ListChange<Item> {
  readonly added: readonly number[];
  readonly removed: readonly { readonly at: number; readonly item: Item }[];
}

/** What one Run action did to the Board and the Army; a list it left alone is missing. */
export interface BoardChange {
  readonly pieces?: ListChange<PlacedPiece>;
  readonly army?: ListChange<PlacedDude>;
}

/** The small parts of the Run a takeable action can change, kept whole as they stood before it. */
export type TakeBackFields = Pick<
  RunState,
  "wallets" | "crate" | "freeItems" | "mutations" | "freeUndos" | "sliders"
>;

export interface TakeBackEntry {
  readonly action: TakeBackAction;
  readonly before: TakeBackFields;
  /** One per Run action in the entry, oldest first: a Stroke or an eraser drag has many. */
  readonly changes: readonly BoardChange[];
}

/** The eraser-drag number a new drag takes: never the newest entry's, so drags don't join. */
export function nextEraserDrag(state: RunState): number {
  return state.takeBack.length;
}

/** What the next Take back would reverse; null when there is nothing to take back. */
export function nextTakeBack(state: RunState): TakeBackAction | null {
  return state.takeBack.at(-1)?.action ?? null;
}

/**
 * The history once `action` has turned `before` into `after`. Takeable actions add an entry, or
 * join the newest one when they continue its Stroke or eraser drag; checkpoints clear it.
 */
export function historyAfter(
  before: RunState,
  after: RunState,
  action: RunAction,
): readonly TakeBackEntry[] {
  const history = before.takeBack;
  switch (action.type) {
    case "place-piece":
      return added(before, after, {
        kind: "place-piece",
        pieceId: action.pieceId,
      });
    case "paint-dude": {
      const newest = history.at(-1)?.action;
      if (newest?.kind === "stroke" && newest.stroke === action.stroke) {
        return joined(before, after, { ...newest, dudes: newest.dudes + 1 });
      }
      return added(before, after, {
        kind: "stroke",
        stroke: action.stroke,
        dudeKind: action.dudeKind,
        dudes: 1,
      });
    }
    case "erase-dude": {
      const newest = history.at(-1)?.action;
      if (newest?.kind === "eraser-drag" && newest.drag === action.drag) {
        return joined(before, after, { ...newest, dudes: newest.dudes + 1 });
      }
      return added(before, after, {
        kind: "eraser-drag",
        drag: action.drag,
        dudes: 1,
      });
    }
    case "take-from-crate": {
      const item = before.crate?.items[action.index];
      if (item === undefined) return history;
      return added(before, after, { kind: "crate-pick", item });
    }
    case "drag-slider":
      // A drag mid-battle stays bought: its double price is the point.
      if (before.phase !== "building") return history;
      return added(before, after, { kind: "slider", slider: action.slider });
    case "take-back":
      return history.slice(0, -1);
    case "reroll-crate":
    case "undo":
    case "start-battle":
    case "battle-finished":
    case "continue":
    case "new-run":
      return [];
  }
}

/** The Run with its newest entry reversed and removed; null when there is nothing to take back. */
export function takenBack(state: RunState): RunState | null {
  const entry = state.takeBack.at(-1);
  if (entry === undefined) return null;
  let { pieces, army } = state;
  for (const change of [...entry.changes].reverse()) {
    if (change.pieces !== undefined) pieces = putBack(pieces, change.pieces);
    if (change.army !== undefined) army = putBack(army, change.army);
  }
  return { ...state, ...entry.before, pieces, army };
}

function added(
  before: RunState,
  after: RunState,
  action: TakeBackAction,
): readonly TakeBackEntry[] {
  const entry: TakeBackEntry = {
    action,
    before: {
      wallets: before.wallets,
      crate: before.crate,
      freeItems: before.freeItems,
      mutations: before.mutations,
      freeUndos: before.freeUndos,
      sliders: before.sliders,
    },
    changes: [boardChange(before, after)],
  };
  return [...before.takeBack, entry];
}

/** The newest entry, carrying on: it keeps its `before`, so taking it back undoes it all. */
function joined(
  before: RunState,
  after: RunState,
  action: TakeBackAction,
): readonly TakeBackEntry[] {
  const newest = before.takeBack.at(-1);
  if (newest === undefined) return added(before, after, action);
  return [
    ...before.takeBack.slice(0, -1),
    {
      ...newest,
      action,
      changes: [...newest.changes, boardChange(before, after)],
    },
  ];
}

function boardChange(before: RunState, after: RunState): BoardChange {
  const pieces = listChange(before.pieces, after.pieces);
  const army = listChange(before.army, after.army);
  return {
    ...(pieces === null ? {} : { pieces }),
    ...(army === null ? {} : { army }),
  };
}

/**
 * Compares by identity: the Run's actions keep the items they don't touch as the same objects,
 * and replace an item they change (a squeezed Dude) with a new one.
 */
function listChange<Item>(
  before: readonly Item[],
  after: readonly Item[],
): ListChange<Item> | null {
  if (before === after) return null;
  const kept = new Set(after);
  const had = new Set(before);
  const removed = before.flatMap((item, at) =>
    kept.has(item) ? [] : [{ at, item }],
  );
  const addedAt = after.flatMap((item, at) => (had.has(item) ? [] : [at]));
  if (removed.length === 0 && addedAt.length === 0) return null;
  return { added: addedAt, removed };
}

/** The list as it stood before `change`: what it added taken out, what it removed put back in place. */
function putBack<Item>(now: readonly Item[], change: ListChange<Item>): Item[] {
  const added = new Set(change.added);
  const list = now.filter((_, at) => !added.has(at));
  const removed = [...change.removed].sort((a, b) => a.at - b.at);
  for (const { at, item } of removed) list.splice(at, 0, item);
  return list;
}
