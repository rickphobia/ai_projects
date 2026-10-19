import { describe, expect, it } from "vitest";
import { startBattle } from "../../src/battle/battle";
import {
  SWARM_ARMY,
  SWARM_DUDES,
  SWARM_RULES,
  swarmMaze,
  wantsSwarmScene,
} from "../../src/debug/swarm-scene";
import { NEUTRAL_SLIDERS } from "../../src/tricks/tricks";

describe("the swarm scene", () => {
  it("sends 500 Interns against a Maze with towers", () => {
    const maze = swarmMaze();
    const state = startBattle({
      maze,
      army: SWARM_ARMY,
      mutations: [],
      seed: 1,
      rules: SWARM_RULES,
      sliders: NEUTRAL_SLIDERS,
      sliderInputs: [],
    });
    expect(SWARM_DUDES).toBe(500);
    expect(state.waiting).toHaveLength(SWARM_DUDES);
    expect(state.towers.length).toBeGreaterThan(0);
  });

  it("is only chosen with the debug flag", () => {
    expect(wantsSwarmScene("?debug=1&scene=swarm")).toBe(true);
    expect(wantsSwarmScene("?scene=swarm")).toBe(false);
    expect(wantsSwarmScene("?debug=1")).toBe(false);
  });
});
