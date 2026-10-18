import type { GameView } from "../adapters/renderer/game-renderer";
import {
  startBattle,
  stepBattleTimes,
  type BattleSetup,
  type BattleState,
} from "../battle/battle";
import type { ShotEvent } from "../battle/events";
import { stepsDue } from "../battle/watch-clock";
import type { Logger } from "../logger";
import type { FpsMeter } from "../ui/fps-meter";
import { SWARM_ARMY, SWARM_DUDES, SWARM_RULES, swarmMaze } from "./swarm-scene";

/**
 * The swarm debug scene on screen: the 500-Intern battle starts by itself, plays at 1x, and
 * starts over when it ends, with the frame rate in the corner. It sits outside the Run, so
 * measuring never touches Run rules. Wiring only.
 */
export function playSwarm(
  view: GameView,
  meter: FpsMeter,
  logger: Logger,
  seed: number,
): void {
  const setup: BattleSetup = {
    maze: swarmMaze(),
    army: SWARM_ARMY,
    seed,
    rules: SWARM_RULES,
  };
  view.showMaze(setup.maze);
  view.showRoute(false);
  view.showArmy([]);

  let state: BattleState = startBattle(setup);
  let carryMs = 0;
  let battles = 1;
  logger.info("swarm scene", { dudes: SWARM_DUDES, seed });
  view.everyFrame((elapsedMs) => {
    meter.frame(elapsedMs, state.dudes.length);
    const due = stepsDue(carryMs, elapsedMs, 1);
    carryMs = due.carryMs;
    const ran = stepBattleTimes(setup, state, due.steps);
    state = ran.state;
    view.showBattle(
      state,
      ran.events.filter((event): event is ShotEvent => event.type === "shot"),
    );
    view.showGoalHealth(state.goalHealth, setup.rules.goalHealth);
    if (state.outcome === null) return;
    logger.info("swarm battle finished", { ...state.outcome, battles });
    battles++;
    view.clearBattle();
    state = startBattle(setup);
  });
}
