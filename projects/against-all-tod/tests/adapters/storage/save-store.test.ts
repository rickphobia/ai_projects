import { describe, expect, it, vi } from "vitest";
import {
  ACTUAL_VOLUME_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  type KeyValueStorage,
} from "../../../src/adapters/storage/save-store";
import type { Logger } from "../../../src/logger";
import { applyRunAction, newRun, type RunState } from "../../../src/run/run";

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
      crate: { items: [{ kind: "mutation", id: "split" }], rerolls: 2 },
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
      sliders: { brightness: -2, volume: 1, "game-speed": 0 },
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
          pieces: [{ pieceId: "crate-wall", tile: { column: 19, row: 6 } }],
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
});
