import { describe, expect, it } from "vitest";
import { hasRoom, isSpawnZonePoint } from "../../src/battle/army";
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
      curse: null,
    });
    expect(SWARM_DUDES).toBe(500);
    expect(state.dudes).toHaveLength(SWARM_DUDES);
    expect(state.towers.length).toBeGreaterThan(0);
  });

  it("stands as an Army a player could paint: in the zone, every Dude with its room", () => {
    for (const [index, dude] of SWARM_ARMY.entries()) {
      expect(isSpawnZonePoint(dude.at, 0)).toBe(true);
      // Its neighbours are within a row or two of it in the list.
      const near = SWARM_ARMY.slice(Math.max(0, index - 25), index);
      expect(hasRoom(near, dude.dudeKind, dude.at)).toBe(true);
    }
  });

  it("is only chosen with the debug flag", () => {
    expect(wantsSwarmScene("?debug=1&scene=swarm")).toBe(true);
    expect(wantsSwarmScene("?scene=swarm")).toBe(false);
    expect(wantsSwarmScene("?debug=1")).toBe(false);
  });
});
