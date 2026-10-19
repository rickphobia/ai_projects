/**
 * Times the swarm scene's battle headless: 500 Interns against the sample Maze, start to end.
 * Run with `npm run bench`. The renderer is measured in the browser instead, with the scene's
 * fps meter (`?debug=1&scene=swarm`).
 */
import {
  STEPS_PER_SECOND,
  startBattle,
  stepBattle,
  type BattleSetup,
} from "../src/battle/battle";
import { SWARM_ARMY, SWARM_RULES, swarmMaze } from "../src/debug/swarm-scene";
import { NEUTRAL_SLIDERS } from "../src/tricks/tricks";

const RUNS = 20;

const setup: BattleSetup = {
  maze: swarmMaze(),
  army: SWARM_ARMY,
  mutations: [],
  seed: 1,
  rules: SWARM_RULES,
  sliders: NEUTRAL_SLIDERS,
  sliderInputs: [],
  curse: null,
};

function runOnce(): { steps: number; mostDudes: number; ms: number } {
  const started = performance.now();
  let state = startBattle(setup);
  let mostDudes = 0;
  while (state.outcome === null) {
    state = stepBattle(setup, state);
    mostDudes = Math.max(mostDudes, state.dudes.length);
  }
  return { steps: state.step, mostDudes, ms: performance.now() - started };
}

// The first runs warm up the JIT; only the rest count.
for (let index = 0; index < 3; index++) runOnce();
const runs = Array.from({ length: RUNS }, runOnce);
const msPerStep = runs.map((run) => run.ms / run.steps).sort((a, b) => a - b);
const median = msPerStep[Math.floor(RUNS / 2)] ?? 0;
const first = runs[0];

console.log(
  [
    `swarm battle: ${String(first?.steps)} steps, up to ${String(first?.mostDudes)} Dudes on the Board at once`,
    `median ${median.toFixed(3)} ms per step over ${String(RUNS)} runs`,
    `at 4x watch speed that is ${(median * 4 * STEPS_PER_SECOND).toFixed(1)} ms of every real second`,
  ].join("\n"),
);
