import { describe, expect, it } from "vitest";
import {
  runBattle,
  startBattle,
  stepBattle,
  stepBattleTimes,
} from "../../src/battle/battle";
import {
  hypeSpeedFactor,
  newDude,
  type DudeState,
} from "../../src/battle/dudes";
import { fireTowers, pickTarget, towersOf } from "../../src/battle/towers";
import { DUDE_KINDS, type DudeKindId } from "../../src/catalog/dudes";
import { PIECES } from "../../src/catalog/pieces";
import { crateWalls, mazeWith, setupOf, wallWithGap } from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };
const SNIPER_STATS = PIECES["sniper-nest"].tower;
if (SNIPER_STATS === null) throw new Error("the Sniper Nest must shoot");

function dudeAt(id: number, kind: DudeKindId, x: number, y: number): DudeState {
  return { ...newDude(id, kind, 0, 0), x, y };
}

/** One volley from a single Sniper Nest at `nest`. */
function sniperVolley(
  nest: { column: number; row: number },
  dudes: DudeState[],
) {
  const maze = mazeWith([{ pieceId: "sniper-nest", tile: nest }]);
  return fireTowers(towersOf(maze), dudes, maze.route, 1, 60);
}

describe("the Balloonist", () => {
  const maze = mazeWith(crateWalls(wallWithGap(8, 13)));
  const setup = setupOf(
    maze,
    [{ dudeKind: "balloonist", spawnRow: 3 }],
    STURDY_GOAL,
  );

  it("flies straight over the Maze to the Goal", () => {
    let state = startBattle(setup);
    let crossedTheWall = false;
    while (state.outcome === null) {
      state = stepBattle(setup, state);
      for (const dude of state.dudes) {
        if (Math.floor(dude.x) === 8 && dude.y < 13) crossedTheWall = true;
        // A walker would go down to the gap in row 13; a flyer never strays toward it.
        expect(dude.y).toBeLessThan(8.5);
      }
    }
    expect(crossedTheWall).toBe(true);
    expect(state.outcome.reason).toBe("army-gone");
    const reached = runBattle(setup).events.filter(
      (event) => event.type === "reach-goal",
    );
    expect(reached).toHaveLength(DUDE_KINDS.balloonist.squadSize);
  });

  it("is shot by a tower that hits air", () => {
    expect(SNIPER_STATS.hitsAir).toBe(true);
    const volley = sniperVolley({ column: 5, row: 5 }, [
      dudeAt(0, "balloonist", 5.5, 3.5),
    ]);
    expect(volley.events.map((event) => event.type)).toEqual(["shot"]);
  });
});

describe("the Shield Bro", () => {
  const nest = { column: 9, row: 3 };

  it("takes a shot aimed at a Dude behind him on his shield", () => {
    // The Streaker draws the shot; the Shield Bro just ahead of him blocks it.
    const bro = dudeAt(0, "shield-bro", 6, 3.5);
    const streaker = dudeAt(1, "streaker", 5, 3.5);
    const volley = sniperVolley(nest, [bro, streaker]);

    expect(volley.events).toEqual([
      expect.objectContaining({ type: "shot", dudeId: bro.id }),
    ]);
    const [broAfter, streakerAfter] = volley.dudes;
    expect(streakerAfter?.health).toBe(DUDE_KINDS.streaker.health);
    expect(broAfter?.health).toBe(DUDE_KINDS["shield-bro"].health);
    expect(broAfter?.shield).toBe(bro.shield - SNIPER_STATS.damage);
  });

  it("stops blocking once the shield breaks", () => {
    const bro = { ...dudeAt(0, "shield-bro", 6, 3.5), shield: 0 };
    const streaker = dudeAt(1, "streaker", 5, 3.5);
    const volley = sniperVolley(nest, [bro, streaker]);

    expect(volley.events[0]).toMatchObject({
      type: "shot",
      dudeId: streaker.id,
    });
    expect(volley.dudes.map((dude) => dude.id)).not.toContain(streaker.id);
  });

  it("doesn't cover a Dude in front of him", () => {
    const bro = dudeAt(0, "shield-bro", 5, 3.5);
    const streaker = dudeAt(1, "streaker", 6, 3.5);
    const volley = sniperVolley(nest, [bro, streaker]);
    expect(volley.events[0]).toMatchObject({
      type: "shot",
      dudeId: streaker.id,
    });
  });
});

describe("the Hype Man", () => {
  const aura = DUDE_KINDS["hype-man"].hypeAura;
  if (aura === null) throw new Error("the Hype Man must have an aura");
  const hypeMan = dudeAt(0, "hype-man", 5, 5);

  it("speeds up the Dudes near him by a boost that grows with Volume", () => {
    const near = dudeAt(1, "intern", 6, 5);
    expect(hypeSpeedFactor(near, [hypeMan], 0)).toBeCloseTo(
      1 + aura.speedBoost,
    );
    expect(hypeSpeedFactor(near, [hypeMan], 2)).toBeGreaterThan(
      1 + aura.speedBoost,
    );
    expect(hypeSpeedFactor(near, [hypeMan], -2)).toBeLessThan(
      1 + aura.speedBoost,
    );
  });

  it("leaves himself and Dudes out of range alone", () => {
    const far = dudeAt(1, "intern", 5 + aura.range + 0.1, 5);
    expect(hypeSpeedFactor(far, [hypeMan], 0)).toBe(1);
    expect(hypeSpeedFactor(hypeMan, [hypeMan], 0)).toBe(1);
  });

  it("reads the battle's Volume level", () => {
    const army = [
      { dudeKind: "hype-man" as const, spawnRow: 3 },
      { dudeKind: "intern" as const, spawnRow: 3 },
    ];
    const internX = (volumeLevel: number, withHype = true) => {
      const setup = setupOf(mazeWith([]), withHype ? army : army.slice(1), {
        ...STURDY_GOAL,
        volumeLevel,
      });
      const { state } = stepBattleTimes(setup, startBattle(setup), 60);
      const first = state.dudes.find((dude) => dude.kind === "intern");
      return first?.x ?? 0;
    };
    expect(internX(0)).toBeGreaterThan(internX(0, false));
    expect(internX(2)).toBeGreaterThan(internX(0));
  });
});

describe("the Mole", () => {
  // A wall down column 5 with its only gap far below: walking around it takes a long detour.
  const maze = mazeWith([
    ...crateWalls(wallWithGap(5, 13)),
    ...crateWalls(wallWithGap(10, 13)),
    { pieceId: "sniper-nest", tile: { column: 7, row: 1 } },
  ]);
  const setup = setupOf(maze, [{ dudeKind: "mole", spawnRow: 3 }], STURDY_GOAL);

  it("tunnels under the Maze once, untargetable, and resurfaces past it", () => {
    let state = startBattle(setup);
    let wentUnder = false;
    while (state.outcome === null) {
      const before = state;
      state = stepBattle(setup, state);
      const underground = new Set(
        before.dudes
          .filter((dude) => dude.burrowTo !== null)
          .map((dude) => dude.id),
      );
      if (underground.size > 0) wentUnder = true;
      for (const event of state.events) {
        if (event.type === "shot")
          expect(underground.has(event.dudeId)).toBe(false);
      }
      for (const dude of state.dudes) {
        const tile = { column: Math.floor(dude.x), row: Math.floor(dude.y) };
        // Above ground a Mole is never inside the wall.
        if (dude.burrowTo === null)
          expect(tile.column === 5 && tile.row !== 13).toBe(false);
        // Its one tunnel is spent on the first wall, so it walks around the second.
        if (tile.column === 10) expect(tile.row).toBe(13);
      }
    }
    expect(wentUnder).toBe(true);
  });
});

describe("the Streaker", () => {
  it("is shot before anything else in range", () => {
    expect(
      pickTarget([
        { id: 1, size: 3, distanceToGoal: 1 },
        { id: 2, size: 1, distanceToGoal: 9, drawsFire: true },
      ]),
    ).toBe(2);
    const volley = sniperVolley({ column: 9, row: 3 }, [
      dudeAt(0, "balloonist", 9.5, 5.5),
      dudeAt(1, "streaker", 4.5, 3.5),
      dudeAt(2, "shield-bro", 12.5, 3.5),
    ]);
    expect(volley.events[0]).toMatchObject({ type: "shot", dudeId: 1 });
  });
});

describe("the Dude kind catalog", () => {
  it("marks the Mole and the Streaker as Unlocks, and nothing else", () => {
    const unlocks = Object.values(DUDE_KINDS)
      .filter((kind) => kind.unlockScore !== null)
      .map((kind) => kind.id);
    expect(unlocks.sort()).toEqual(["mole", "streaker"]);
  });
});
