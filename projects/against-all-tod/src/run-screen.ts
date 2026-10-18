import type { GameView } from "./adapters/renderer/game-renderer";
import {
  STEPS_PER_SECOND,
  startBattle,
  stepBattleTimes,
  type BattleOutcome,
  type BattleSetup,
  type BattleState,
  type Side,
} from "./battle/battle";
import type { BattleEvent, ShotEvent } from "./battle/events";
import { stepsDue, type WatchSpeed } from "./battle/watch-clock";
import { BATTLE_RULES } from "./catalog/battle-rules";
import type { DudeKindId } from "./catalog/dudes";
import { PIECES, type PieceId } from "./catalog/pieces";
import { giveGold, jumpToRound } from "./debug/debug-options";
import { goldEarned, type BattleEnd } from "./economy/economy";
import type { Logger } from "./logger";
import type { Tile } from "./maze/board";
import { pieceAt, type Maze } from "./maze/maze";
import {
  applyRunAction,
  battleSetupOf,
  checkPiece,
  checkSquad,
  mazeOf,
  roundOf,
  runStatusOf,
  sideOf,
  type RunAction,
  type RunState,
} from "./run/run";
import type { CratePanel } from "./ui/crate";
import type { EndScreen } from "./ui/end-screen";
import type { Hud } from "./ui/hud";
import type { PieceInfo } from "./ui/piece-info";
import { roundReport, type RoundReportPanel } from "./ui/report";
import type { ShopStock } from "./ui/shop";

/** What the shop sells each side until Draft Crates and Unlocks arrive. */
export const SHOP_STOCK: ShopStock = {
  pieces: ["crate-wall", "sniper-nest"],
  dudeKinds: ["intern"],
};
/** The Piece chosen when the page opens. */
export const FIRST_BUILD_PIECE: PieceId = "crate-wall";
const FIRST_DUDE_KIND: DudeKindId = "intern";

interface Battle {
  readonly setup: BattleSetup;
  state: BattleState;
  carryMs: number;
  /** Every kill and Goal hit so far, for the gold. */
  readonly goldEvents: BattleEvent[];
  readonly stop: () => void;
}

/**
 * A Run on screen: Board taps and HUD buttons become Run actions, the battle is stepped each
 * frame and its winner handed back to the Run, and the result is drawn. Wiring only; the rules
 * are in run, maze and battle.
 */
export class RunScreen {
  private run: RunState;
  /** The Maze of `run.pieces`, for drawing and piece info. */
  private maze: Maze;
  private chosenPiece: PieceId = FIRST_BUILD_PIECE;
  private chosenDudeKind: DudeKindId = FIRST_DUDE_KIND;
  private watchSpeed: WatchSpeed = 1;
  private battle: Battle | null = null;
  private hud: Hud | undefined;
  private endScreen: EndScreen | undefined;
  private cratePanel: CratePanel | undefined;
  private report: RoundReportPanel | undefined;
  /** The route preview; the debug options can hide it. */
  private routeVisible = true;

  /** `run` is a new or loaded Run; `onRunChanged` saves it after every accepted action. */
  constructor(
    private readonly view: GameView,
    private readonly pieceInfo: PieceInfo,
    private readonly logger: Logger,
    run: RunState,
    private readonly onRunChanged: (run: RunState) => void,
  ) {
    this.run = run;
    this.maze = mazeOf(this.run.pieces);
  }

  /**
   * Shows the Run where it stands. A Run saved mid-battle restarts that battle from its start;
   * one saved on a Round's result goes on to the next Round. The HUD, end screen and crate panel
   * are passed in late because their buttons call back here.
   */
  begin(
    hud: Hud,
    endScreen: EndScreen,
    cratePanel: CratePanel,
    report: RoundReportPanel,
  ): void {
    this.report = report;
    this.hud = hud;
    this.endScreen = endScreen;
    this.cratePanel = cratePanel;
    this.view.listenToBoard({
      onHover: (tile) => {
        if (!this.showPieceInfo(tile)) this.pieceInfo.hide();
        if (this.run.phase !== "building") return;
        this.view.showPlacementCursor(
          tile,
          tile !== null && this.canPlaceOn(tile),
        );
      },
      onTap: (tile, kind) => {
        // Tapping a Piece asks what it does; on touch that is the only way to ask.
        if (this.showPieceInfo(tile)) return;
        this.pieceInfo.hide();
        if (this.run.phase !== "building") return;
        if (!this.act(this.placeAction(tile))) return;
        // The tile under the mouse is now taken; a finger has lifted, so there is no cursor.
        if (kind === "mouse") this.view.showPlacementCursor(tile, false);
      },
    });
    switch (this.run.phase) {
      case "building":
        this.logRoundStart();
        this.showBuilding();
        return;
      case "fighting":
        this.logRoundStart();
        // The Maze is drawn while building; a battle restarted from a save needs it too.
        this.showBuilding();
        this.watchBattle();
        return;
      case "round-won":
      case "round-lost":
        this.continue();
        return;
      case "run-over":
        this.showBuilding();
        endScreen.show(this.run.score, this.run.bestScore);
        return;
    }
  }

  choosePiece(pieceId: PieceId): void {
    if (this.run.phase !== "building") return;
    this.chosenPiece = pieceId;
    this.showBuilding();
  }

  chooseDudeKind(dudeKind: DudeKindId): void {
    if (this.run.phase !== "building") return;
    this.chosenDudeKind = dudeKind;
    this.showBuilding();
  }

  /** Takes crate item `index`; a Piece or Squad becomes the chosen one, ready to place for free. */
  takeFromCrate(index: number): void {
    if (!this.act({ type: "take-from-crate", index })) return;
    const free = this.run.freeItem;
    if (free?.kind === "piece") this.chosenPiece = free.id;
    if (free?.kind === "squad") this.chosenDudeKind = free.id;
    this.logger.info("took from crate", {
      round: roundOf(this.run),
      item: free ?? this.run.mutations.at(-1),
    });
    this.showBuilding();
  }

  rerollCrate(): void {
    if (!this.act({ type: "reroll-crate" })) return;
    this.logger.info("rerolled crate", {
      round: roundOf(this.run),
      rerolls: this.run.crate?.rerolls,
    });
    this.showBuilding();
  }

  fight(): void {
    if (!this.act({ type: "start-battle" })) return;
    this.watchBattle();
  }

  /** Debug option: adds gold to one side's wallet. */
  giveGold(side: Side, amount: number): void {
    if (this.run.phase === "fighting") return;
    this.replaceRun(giveGold(this.run, side, amount));
    this.logger.info("debug: gave gold", { side, amount });
  }

  /** Debug option: starts Round `round` with the Board as it is. */
  jumpToRound(round: number): void {
    const jumped = jumpToRound(this.run, round);
    if (jumped === null) {
      this.hud?.showMessage("Can't jump now, or to that Round.");
      return;
    }
    this.replaceRun(jumped);
    this.logger.info("debug: jumped to Round", { round });
    this.logRoundStart();
  }

  /** Debug option: shows or hides the route preview. */
  toggleRoute(): void {
    this.routeVisible = !this.routeVisible;
    if (this.run.phase === "building") this.view.showRoute(this.routeVisible);
  }

  private replaceRun(run: RunState): void {
    this.run = run;
    this.onRunChanged(run);
    this.showBuilding();
  }

  /** Starts watching the Round's battle; the Run is already in its fighting phase. */
  private watchBattle(): void {
    const setup = battleSetupOf(this.run);
    this.logger.info("battle started", {
      round: roundOf(this.run),
      side: sideOf(this.run),
      seed: setup.seed,
      pieces: this.run.pieces.length,
      squads: setup.army.length,
    });
    this.view.showPlacementCursor(null, false);
    this.view.showRoute(false);
    this.cratePanel?.hide();
    this.view.showArmy([]);
    const stop = this.view.everyFrame((elapsedMs) => {
      this.watchFrame(elapsedMs);
    });
    this.battle = {
      setup,
      state: startBattle(setup),
      carryMs: 0,
      goldEvents: [],
      stop,
    };
    this.hud?.showBattle(sideOf(this.run), this.watchSpeed);
    this.showBattle(this.battle.state, []);
  }

  setWatchSpeed(speed: WatchSpeed): void {
    this.watchSpeed = speed;
    if (this.battle !== null) this.hud?.showBattle(sideOf(this.run), speed);
  }

  /** After a Round's result: on to the next Round, or the same one Rewound. */
  continue(): void {
    if (!this.act({ type: "continue" })) return;
    this.logRoundStart();
    this.showBuilding();
  }

  newRun(): void {
    if (!this.act({ type: "new-run" })) return;
    this.endScreen?.hide();
    this.logger.info("new Run", {
      seed: this.run.seed,
      bestScore: this.run.bestScore,
    });
    this.logRoundStart();
    this.showBuilding();
  }

  /** Applies a Run action; a refusal is logged and shown, and false returned. */
  private act(action: RunAction): boolean {
    const result = applyRunAction(this.run, action);
    if (!result.ok) {
      this.logger.info("action refused", {
        action: action.type,
        refusal: result.refusal,
      });
      this.hud?.showRefusal(result.refusal);
      return false;
    }
    if (result.state.pieces !== this.run.pieces) {
      this.maze = mazeOf(result.state.pieces);
    }
    this.run = result.state;
    this.onRunChanged(this.run);
    if (action.type === "place-piece" || action.type === "place-squad") {
      this.logger.debug("placed", { ...action });
      this.showBuilding();
    }
    return true;
  }

  private placeAction(tile: Tile): RunAction {
    return sideOf(this.run) === "defense"
      ? { type: "place-piece", tile, pieceId: this.chosenPiece }
      : { type: "place-squad", tile, dudeKind: this.chosenDudeKind };
  }

  private canPlaceOn(tile: Tile): boolean {
    if (sideOf(this.run) === "defense") {
      return checkPiece(this.run, tile, this.chosenPiece) === null;
    }
    return checkSquad(this.run, tile, this.chosenDudeKind) === null;
  }

  /** Shows the Piece on `tile` in the info panel; false if there is none. */
  private showPieceInfo(tile: Tile | null): boolean {
    const id = tile === null ? undefined : pieceAt(this.maze, tile);
    if (id === undefined) return false;
    this.pieceInfo.show(PIECES[id]);
    return true;
  }

  /** The Board as the Run has it, ready for placing. */
  private showBuilding(): void {
    this.view.clearBattle();
    this.view.showMaze(this.maze);
    this.view.showRoute(this.routeVisible);
    this.view.showArmy(this.run.army);
    this.view.showGoalHealth(BATTLE_RULES.goalHealth, BATTLE_RULES.goalHealth);
    this.showRunStatus();
    if (this.run.phase === "building") {
      this.cratePanel?.show(
        this.run.crate,
        this.run.freeItem,
        sideOf(this.run),
      );
    } else {
      this.cratePanel?.hide();
    }
    if (sideOf(this.run) === "defense") {
      this.view.choosePiece(this.chosenPiece);
      this.hud?.showDefenseBuilding(this.chosenPiece);
    } else {
      this.view.chooseSquad(this.chosenDudeKind);
      this.hud?.showAttackBuilding(this.chosenDudeKind);
    }
  }

  private showRunStatus(): void {
    this.hud?.showRunStatus(runStatusOf(this.run));
  }

  private watchFrame(elapsedMs: number): void {
    const battle = this.battle;
    if (battle === null) return;
    const due = stepsDue(battle.carryMs, elapsedMs, this.watchSpeed);
    battle.carryMs = due.carryMs;
    const ran = stepBattleTimes(battle.setup, battle.state, due.steps);
    battle.state = ran.state;
    for (const event of ran.events) {
      if (event.type !== "shot") battle.goldEvents.push(event);
    }
    this.showBattle(
      ran.state,
      ran.events.filter((event): event is ShotEvent => event.type === "shot"),
    );
    const outcome = ran.state.outcome;
    if (outcome === null) return;

    battle.stop();
    this.battle = null;
    this.finishRound(outcome, battle);
  }

  private finishRound(outcome: BattleOutcome, battle: Battle): void {
    const round = roundOf(this.run);
    const side = sideOf(this.run);
    const bestBefore = this.run.bestScore;
    const end = battle.state;
    const battleEnd: BattleEnd = {
      winner: outcome.winner,
      goalHealth: end.goalHealth,
      survivors: [
        ...end.dudes.map((dude) => dude.kind),
        ...end.waiting.map(({ dude }) => dude.kind),
      ],
    };
    const earned = goldEarned(battle.goldEvents, battleEnd);
    const destroyed = battle.goldEvents.flatMap((event) =>
      event.type === "piece-destroyed" ? [event.pieceTile] : [],
    );
    if (
      !this.act({
        type: "battle-finished",
        winner: outcome.winner,
        earned,
        destroyed,
      })
    ) {
      return;
    }
    const won = outcome.winner === side;
    this.logger.info("Round finished", {
      round,
      side,
      won,
      ...outcome,
      goalHealth: battle.state.goalHealth,
      kills: battle.goldEvents.filter((event) => event.type === "kill").length,
      reachedGoal: battle.goldEvents.filter(
        (event) => event.type === "reach-goal",
      ).length,
      piecesDestroyed: destroyed.length,
      earned,
      wallets: this.run.wallets,
      lives: this.run.lives,
      score: this.run.score,
    });
    this.showRunStatus();
    // Over the HUD or end screen; closing it shows what comes next.
    this.report?.show(roundReport(battle.goldEvents, battleEnd), won);
    if (this.run.phase === "run-over") {
      this.logger.info("Run over", {
        seed: this.run.seed,
        score: this.run.score,
        bestScore: this.run.bestScore,
      });
      this.endScreen?.show(this.run.score, bestBefore);
      return;
    }
    this.hud?.showRoundOver(outcome, won, this.run.lives);
  }

  private logRoundStart(): void {
    this.logger.info("Round started", { ...runStatusOf(this.run) });
  }

  private showBattle(state: BattleState, newShots: readonly ShotEvent[]): void {
    this.view.showBattle(state, newShots);
    this.view.showGoalHealth(state.goalHealth, BATTLE_RULES.goalHealth);
    this.hud?.showBattleStatus(
      state.goalHealth,
      BATTLE_RULES.goalHealth,
      state.step / STEPS_PER_SECOND,
    );
  }
}
