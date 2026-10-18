import { describe, expect, it, vi } from "vitest";
import { newDude } from "../../src/battle/dudes";
import { fireTowers, towersOf } from "../../src/battle/towers";
import { mazeWith } from "./battle-setups";

// A tower that can't hit air, until one ships in the catalog: the Sniper Nest with its flag off.
vi.mock("../../src/catalog/pieces", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/catalog/pieces")>();
  const sniper = original.PIECES["sniper-nest"];
  if (sniper.tower === null) throw new Error("the Sniper Nest must shoot");
  return {
    ...original,
    PIECES: {
      ...original.PIECES,
      "sniper-nest": { ...sniper, tower: { ...sniper.tower, hitsAir: false } },
    },
  };
});

describe("a tower that doesn't hit air", () => {
  it("never targets a Balloonist, but still shoots walkers", () => {
    const maze = mazeWith([
      { pieceId: "sniper-nest", tile: { column: 5, row: 5 } },
    ]);
    const balloonist = { ...newDude(0, "balloonist", 0, 0), x: 5.5, y: 3.5 };
    const intern = { ...newDude(1, "intern", 0, 0), x: 3.5, y: 8.5 };

    const balloonOnly = fireTowers(
      towersOf(maze),
      [balloonist],
      maze.route,
      1,
      60,
    );
    expect(balloonOnly.events).toEqual([]);

    const both = fireTowers(
      towersOf(maze),
      [balloonist, intern],
      maze.route,
      1,
      60,
    );
    expect(both.events[0]).toMatchObject({ type: "shot", dudeId: intern.id });
  });
});
