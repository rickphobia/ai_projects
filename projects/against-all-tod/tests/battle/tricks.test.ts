import { describe, expect, it } from "vitest";
import {
  runBattle,
  startBattle,
  STEPS_PER_SECOND,
  stepBattleTimes,
  type BattleSetup,
} from "../../src/battle/battle";
import { newDude, type DudeState } from "../../src/battle/dudes";
import { fireTowers, towersOf } from "../../src/battle/towers";
import { towerTricks } from "../../src/battle/tricks";
import { PIECES } from "../../src/catalog/pieces";
import { TRICK_RULES } from "../../src/catalog/tricks";
import type { Maze } from "../../src/maze/maze";
import {
  NEUTRAL_SLIDERS,
  type SliderInput,
  type SliderPositions,
} from "../../src/tricks/tricks";
import { internSquads, mazeWith, setupOf } from "./battle-setups";

const SNIPER_RANGE = PIECES["sniper-nest"].tower?.range ?? 0;
const NEST = { pieceId: "sniper-nest" as const, tile: { column: 10, row: 6 } };
/** Lights the Sniper Nest's tile: two rows below it, within the light radius. */
const LIGHTHOUSE = {
  pieceId: "lighthouse" as const,
  tile: { column: 10, row: 8 },
};

function sliders(brightness: number, gameSpeed = 0): SliderPositions {
  return { brightness, "game-speed": gameSpeed };
}

/** An Intern standing `distance` tiles right of the Sniper Nest's centre. */
function internFromNest(distance: number): DudeState {
  return { ...newDude(0, "intern", 6, 0), x: 10.5 + distance, y: 6.5 };
}

/** Whether the Sniper Nest shoots an Intern `distance` away, with the sliders at `positions`. */
function shootsAt(
  maze: Maze,
  distance: number,
  positions: SliderPositions,
): boolean {
  const tower = towersOf(maze).find((it) => it.pieceId === "sniper-nest");
  if (tower === undefined) throw new Error("no Sniper Nest");
  const { events } = fireTowers(
    [tower],
    [internFromNest(distance)],
    maze.route,
    1,
    STEPS_PER_SECOND,
    towerTricks(positions, maze),
  );
  return events.some((event) => event.type === "shot");
}

/** How far right the first Intern has walked after `steps` steps on an empty Board. */
function walkedAfter(steps: number, positions: SliderPositions): number {
  const setup = withSliders(setupOf(mazeWith([]), internSquads(6)), positions);
  const { state } = stepBattleTimes(setup, startBattle(setup), steps);
  const first = state.dudes.find((dude) => dude.id === 0);
  if (first === undefined) throw new Error("the first Intern is gone");
  return first.x;
}

function withSliders(
  setup: BattleSetup,
  positions: SliderPositions,
  sliderInputs: readonly SliderInput[] = [],
): BattleSetup {
  return { ...setup, sliders: positions, sliderInputs };
}

describe("Brightness down", () => {
  const darkOne = SNIPER_RANGE * (1 - TRICK_RULES.rangeLossPerDarkStep);
  const darkTwo = SNIPER_RANGE * (1 - 2 * TRICK_RULES.rangeLossPerDarkStep);
  const maze = mazeWith([NEST]);

  it("shrinks a tower's range by a share per step", () => {
    const pastOneStep = (darkOne + SNIPER_RANGE) / 2;
    const pastTwoSteps = (darkTwo + darkOne) / 2;
    expect(shootsAt(maze, pastOneStep, NEUTRAL_SLIDERS)).toBe(true);
    expect(shootsAt(maze, pastOneStep, sliders(-1))).toBe(false);
    expect(shootsAt(maze, pastTwoSteps, sliders(-1))).toBe(true);
    expect(shootsAt(maze, pastTwoSteps, sliders(-2))).toBe(false);
  });

  it("leaves a tower on a tile a Lighthouse lights at full range", () => {
    const lit = mazeWith([NEST, LIGHTHOUSE]);
    expect(shootsAt(lit, (darkTwo + SNIPER_RANGE) / 2, sliders(-2))).toBe(true);
  });

  it("never touches the Lighthouse's own beam", () => {
    const setup = setupOf(mazeWith([LIGHTHOUSE]), internSquads(8));
    const beamHits = (positions: SliderPositions) =>
      runBattle(withSliders(setup, positions)).events.filter(
        (event) => event.type === "kill",
      ).length;
    expect(beamHits(NEUTRAL_SLIDERS)).toBeGreaterThan(0);
    expect(beamHits(sliders(-2))).toBe(beamHits(NEUTRAL_SLIDERS));
  });
});

describe("Brightness up", () => {
  it("dazzles Dudes and slows them per step", () => {
    const start = 0.5;
    const neutral = walkedAfter(60, NEUTRAL_SLIDERS) - start;
    const brightOne = walkedAfter(60, sliders(1)) - start;
    const brightTwo = walkedAfter(60, sliders(2)) - start;
    expect(brightOne).toBeCloseTo(
      neutral * (1 - TRICK_RULES.slowPerBrightStep),
    );
    expect(brightTwo).toBeCloseTo(
      neutral * (1 - 2 * TRICK_RULES.slowPerBrightStep),
    );
  });

  it("leaves tower range alone", () => {
    const maze = mazeWith([NEST]);
    expect(shootsAt(maze, SNIPER_RANGE - 0.1, sliders(2))).toBe(true);
  });
});

describe("Game speed", () => {
  /** Shots one Sniper Nest fires over `steps` steps at an Intern that never dies or moves. */
  function shotsOver(steps: number, positions: SliderPositions): number {
    const maze = mazeWith([NEST]);
    const tricks = towerTricks(positions, maze);
    let towers = towersOf(maze);
    let shots = 0;
    for (let step = 1; step <= steps; step++) {
      const volley = fireTowers(
        towers,
        [{ ...internFromNest(1), health: 1e9, fullHealth: 1e9 }],
        maze.route,
        step,
        STEPS_PER_SECOND,
        tricks,
      );
      towers = volley.towers;
      shots += volley.events.filter((event) => event.type === "shot").length;
    }
    return shots;
  }

  it("up makes Dudes faster and towers slower to reload", () => {
    const start = 0.5;
    const neutral = walkedAfter(60, NEUTRAL_SLIDERS) - start;
    expect(walkedAfter(60, sliders(0, 2)) - start).toBeCloseTo(
      neutral * (1 + 2 * TRICK_RULES.dudeSpeedPerGameStep),
    );
    expect(shotsOver(600, sliders(0, 2))).toBeLessThan(
      shotsOver(600, NEUTRAL_SLIDERS),
    );
  });

  it("down gives towers extra shots and slows Dudes", () => {
    const start = 0.5;
    expect(shotsOver(600, sliders(0, -1))).toBeGreaterThan(
      shotsOver(600, NEUTRAL_SLIDERS),
    );
    expect(shotsOver(600, sliders(0, -2))).toBeGreaterThan(
      shotsOver(600, sliders(0, -1)),
    );
    expect(walkedAfter(60, sliders(0, -1)) - start).toBeLessThan(
      walkedAfter(60, NEUTRAL_SLIDERS) - start,
    );
  });
});

describe("a slider dragged mid-battle", () => {
  const setup = setupOf(mazeWith([NEST]), internSquads(5, 6, 7));
  const dragged = withSliders(setup, NEUTRAL_SLIDERS, [
    { step: 4 * STEPS_PER_SECOND, slider: "brightness", position: -2 },
    { step: 6 * STEPS_PER_SECOND, slider: "game-speed", position: 2 },
  ]);

  it("changes nothing before its step", () => {
    const before = 4 * STEPS_PER_SECOND - 1;
    const plain = stepBattleTimes(setup, startBattle(setup), before);
    const withDrag = stepBattleTimes(dragged, startBattle(dragged), before);
    expect(withDrag.state).toEqual(plain.state);
  });

  it("changes the battle from its step on", () => {
    expect(runBattle(dragged).events).not.toEqual(runBattle(setup).events);
  });

  it("replays the same from the same seed and inputs", () => {
    const first = runBattle(dragged);
    const second = runBattle(dragged);
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
  });
});
