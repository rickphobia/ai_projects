import { describe, expect, it, vi } from "vitest";
import {
  ACTUAL_VOLUME_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  type KeyValueStorage,
} from "../../../src/adapters/storage/save-store";
import type { Logger } from "../../../src/logger";
import {
  applyRunAction,
  newRun,
  type RunAction,
  type RunState,
} from "../../../src/run/run";

class FakeStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** A Logger whose warnings are kept in `warn` for the test to check. */
function fakeLogger(): { logger: Logger; warn: ReturnType<typeof vi.fn> } {
  const warn = vi.fn();
  return {
    warn,
    logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
  };
}

function storeWith(raw?: string) {
  const storage = new FakeStorage();
  if (raw !== undefined) storage.setItem(SAVE_KEY, raw);
  const { logger, warn } = fakeLogger();
  return { storage, warn, store: new SaveStore(() => storage, logger) };
}

/** A Run part-way through: a Piece placed and the battle about to start. */
function readyToFight(): RunState {
  const placed = applyRunAction(newRun(42, 3), {
    type: "place-piece",
    tile: { column: 5, row: 4 },
    pieceId: "crate-wall",
  });
  if (!placed.ok) throw new Error(placed.refusal);
  const fighting = applyRunAction(placed.state, { type: "start-battle" });
  if (!fighting.ok) throw new Error(fighting.refusal);
  return fighting.state;
}

describe("SaveStore", () => {
  it("loads back exactly the Run it saved", () => {
    const { store } = storeWith();
    const run = readyToFight();
    store.save(run);
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("loads back the crate, a free item and the Mutations", () => {
    const { store } = storeWith();
    const taken = applyRunAction(newRun(42), {
      type: "take-from-crate",
      index: 0,
    });
    if (!taken.ok) throw new Error(taken.refusal);
    const run: RunState = {
      ...taken.state,
      mutations: ["gold-teeth"],
      crate: {
        items: [{ kind: "mutation", id: "split" }, { kind: "free-undo" }],
        kind: "boss",
        picks: 2,
        rerolls: 2,
      },
    };
    store.save(run);
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("loads a save from before boss crates: one pick, the single free item", () => {
    const { store, storage } = storeWith();
    const taken = applyRunAction(newRun(42), {
      type: "take-from-crate",
      index: 0,
    });
    if (!taken.ok) throw new Error(taken.refusal);
    store.save(taken.state);
    const saved = JSON.parse(storage.getItem(SAVE_KEY) ?? "") as {
      run: Record<string, unknown>;
    };
    const { freeItems, ...old } = saved.run;
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...saved,
        run: {
          ...old,
          freeItem: (freeItems as unknown[])[0],
          crate: { items: [{ kind: "piece", id: "siren" }], rerolls: 1 },
        },
      }),
    );
    expect(store.load()).toEqual({
      kind: "loaded",
      run: {
        ...taken.state,
        crate: {
          kind: "draft",
          items: [{ kind: "piece", id: "siren" }],
          picks: 1,
          rerolls: 1,
        },
      },
    });
  });

  it("loads back a painted Army, which Dudes came from the gift, and a half-used crate gift", () => {
    const { store } = storeWith();
    const start = newRun(42);
    const run: RunState = {
      ...start,
      score: 1,
      army: [
        ...start.army,
        {
          dudeKind: "termite",
          at: { x: 0.25, y: 6.75 },
          stroke: 5,
          round: 2,
          fromGift: true,
        },
        { dudeKind: "intern", at: { x: 2.9, y: 13.1 }, stroke: 6, round: 2 },
      ],
      crate: null,
      freeItems: [
        { kind: "gift", id: "termite", left: 9 },
        { kind: "piece", id: "siren" },
      ],
    };
    store.save(run);
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("loads back the sliders and a mid-battle drag", () => {
    const { store } = storeWith();
    const dragged = applyRunAction(readyToFight(), {
      type: "drag-slider",
      slider: "game-speed",
      to: 1,
      atStep: 90,
    });
    if (!dragged.ok) throw new Error(dragged.refusal);
    const run: RunState = {
      ...dragged.state,
      sliders: {
        brightness: -2,
        volume: 1,
        "window-size": 0,
        "game-speed": 0,
      },
    };
    store.save(run);
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("tags the save with its version", () => {
    const { store, storage } = storeWith();
    store.save(newRun(1));
    const saved = JSON.parse(storage.getItem(SAVE_KEY) ?? "") as {
      version: number;
    };
    expect(saved.version).toBe(SAVE_VERSION);
  });

  it("reports empty storage as no save, without a warning", () => {
    const { store, warn } = storeWith();
    expect(store.load()).toEqual({ kind: "empty" });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "{oops"],
    ["an old version", JSON.stringify({ version: 0, run: newRun(1) })],
    [
      "a future version",
      JSON.stringify({ version: SAVE_VERSION + 1, run: newRun(1) }),
    ],
    [
      "a save of Squads, from before painting",
      JSON.stringify({
        version: SAVE_VERSION - 1,
        run: {
          ...newRun(1),
          army: [{ dudeKind: "intern", tile: { column: 1, row: 3 } }],
        },
      }),
    ],
    [
      "a Squad in a save of this version",
      JSON.stringify({
        version: SAVE_VERSION,
        run: {
          ...newRun(1),
          army: [{ dudeKind: "intern", tile: { column: 1, row: 3 } }],
        },
      }),
    ],
    [
      "a Dude outside the Spawn zone",
      JSON.stringify({
        version: SAVE_VERSION,
        run: {
          ...newRun(1),
          army: [
            { dudeKind: "intern", at: { x: 5.5, y: 3.5 }, stroke: 0, round: 1 },
          ],
        },
      }),
    ],
    ["no Run", JSON.stringify({ version: SAVE_VERSION })],
    [
      "an unknown Piece",
      JSON.stringify({
        version: SAVE_VERSION,
        run: {
          ...newRun(1),
          pieces: [{ pieceId: "laser", tile: { column: 3, row: 3 } }],
        },
      }),
    ],
    [
      "negative gold",
      JSON.stringify({
        version: SAVE_VERSION,
        run: { ...newRun(1), wallets: { defense: -5, attack: 0 } },
      }),
    ],
    [
      "a slider off its end",
      JSON.stringify({
        version: SAVE_VERSION,
        run: { ...newRun(1), sliders: { brightness: 3, "game-speed": 0 } },
      }),
    ],
    [
      "a Piece on the Goal",
      JSON.stringify({
        version: SAVE_VERSION,
        run: {
          ...newRun(1),
          pieces: [{ pieceId: "crate-wall", tile: { column: 21, row: 6 } }],
        },
      }),
    ],
  ])("gives a fresh start and a warning for %s", (_, raw) => {
    const { store, warn } = storeWith(raw);
    expect(store.load().kind).toBe("unreadable");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("never logs the save itself", () => {
    const { store, warn } = storeWith("secret-ish {");
    store.load();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-ish");
  });

  it("treats blocked storage as unreadable instead of throwing", () => {
    const { logger, warn } = fakeLogger();
    const store = new SaveStore(() => {
      throw new Error("SecurityError");
    }, logger);
    expect(store.load().kind).toBe("unreadable");
    expect(() => {
      store.save(newRun(1));
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps the actual volume apart from the Run", () => {
    const { store } = storeWith();
    expect(store.loadActualVolume(0.5)).toBe(0.5);
    store.saveActualVolume(0.25);
    expect(store.loadActualVolume(0.5)).toBe(0.25);
    expect(store.load()).toEqual({ kind: "empty" });
  });

  it("falls back on an actual volume it can't use", () => {
    const { store, storage, warn } = storeWith();
    storage.setItem(ACTUAL_VOLUME_KEY, "loud");
    expect(store.loadActualVolume(0.5)).toBe(0.5);
    expect(warn).toHaveBeenCalled();
  });

  it("keeps the best Score and the first-Run flag", () => {
    const run = { ...readyToFight(), bestScore: 12, firstRun: false };
    const { store } = storeWith();
    store.save(run);
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("treats a save from before hints as past the first Run", () => {
    const run = readyToFight();
    const old: Record<string, unknown> = { ...run };
    delete old.firstRun;
    const { store } = storeWith(
      JSON.stringify({ version: SAVE_VERSION, run: old }),
    );
    expect(store.load()).toEqual({
      kind: "loaded",
      run: { ...run, firstRun: false },
    });
  });

  it("loads a save from before the Volume trick with Volume in the middle", () => {
    const run = readyToFight();
    const oldSliders = {
      brightness: run.sliders.brightness,
      "game-speed": run.sliders["game-speed"],
    };
    const { store } = storeWith(
      JSON.stringify({
        version: SAVE_VERSION,
        run: { ...run, sliders: oldSliders },
      }),
    );
    expect(store.load()).toEqual({ kind: "loaded", run });
  });

  it("loads back a Piece on a lane and an Army squeezed by Window size", () => {
    const rich = {
      ...newRun(42),
      wallets: { defense: 1000, attack: 1000 },
    };
    const resize = (to: number): RunAction => ({
      type: "drag-slider",
      slider: "window-size",
      to,
      atStep: 0,
    });
    const lane = apply(apply(rich, resize(1)), {
      type: "place-piece",
      tile: { column: 5, row: -1 },
      pieceId: "crate-wall",
    });
    const edgeDude = {
      dudeKind: "intern",
      at: { x: 1.5, y: 0.5 },
      stroke: 9,
      round: 1,
    } as const;
    const squeezed = apply(
      { ...rich, army: [...rich.army, edgeDude] },
      resize(-2),
    );
    for (const run of [lane, squeezed]) {
      const { store } = storeWith();
      store.save(run);
      expect(store.load()).toEqual({ kind: "loaded", run });
    }
    expect(squeezed.army.at(-1)?.at).toEqual({ x: 1.5, y: 2.5 });
  });
});

function apply(state: RunState, action: RunAction): RunState {
  const result = applyRunAction(state, action);
  if (!result.ok) throw new Error(result.refusal);
  return result.state;
}
