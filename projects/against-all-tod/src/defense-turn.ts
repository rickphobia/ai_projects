import type { GameView } from "./adapters/renderer/game-renderer";
import {
  STEPS_PER_SECOND,
  startBattle,
  stepBattleTimes,
  type BattleSetup,
  type BattleState,
} from "./battle/battle";
import type { ShotEvent } from "./battle/events";
import { stepsDue, type WatchSpeed } from "./battle/watch-clock";
import type { Army } from "./battle/army";
import { BATTLE_RULES, type BattleRules } from "./catalog/battle-rules";
import { ROUND_ONE_ARMY } from "./catalog/dudes";
import { PIECES, type PieceId } from "./catalog/pieces";
import type { Logger } from "./logger";
import type { Tile } from "./maze/board";
import {
  checkPlacement,
  emptyMaze,
  pieceAt,
  placePiece,
  type Maze,
} from "./maze/maze";
import type { Hud } from "./ui/hud";
import type { PieceInfo } from "./ui/piece-info";

/** The Pieces on offer until Draft Crates and the shop arrive. */
export const BUILD_PIECES: readonly PieceId[] = ["crate-wall", "sniper-nest"];
/** The Piece chosen when the page opens. */
export const FIRST_BUILD_PIECE: PieceId = "crate-wall";

/** What a Defense turn starts from and fights against. */
export interface TurnScene {
  readonly maze: Maze;
  readonly army: Army;
  readonly rules: BattleRules;
}

/** The normal turn: an empty Board against the Round 1 Army. Debug scenes swap in their own. */
export function roundOneScene(): TurnScene {
  return { maze: emptyMaze(), army: ROUND_ONE_ARMY, rules: BATTLE_RULES };
}

type Phase =
  | { readonly kind: "building" }
  | {
      readonly kind: "fighting";
      readonly setup: BattleSetup;
      state: BattleState;
      carryMs: number;
      kills: number;
      reachedGoal: number;
      readonly stop: () => void;
    }
  | { readonly kind: "finished" };

/**
 * One Defense turn, over and over: build, press Fight, watch the game-made Army attack, see who
 * won, build on. Wiring only; the rules are in maze and battle. The run module replaces this
 * once Rounds exist.
 */
export class DefenseTurn {
  private maze: Maze;
  private chosenPiece: PieceId = FIRST_BUILD_PIECE;
  private watchSpeed: WatchSpeed = 1;
  private phase: Phase = { kind: "building" };
  private hud: Hud | undefined;

  constructor(
    private readonly view: GameView,
    private readonly pieceInfo: PieceInfo,
    private readonly logger: Logger,
    private readonly seed: number,
    private readonly scene: TurnScene,
  ) {
    this.maze = scene.maze;
  }

  /** Starts in the building phase. The HUD is passed in late because its buttons call back here. */
  begin(hud: Hud): void {
    this.hud = hud;
    this.view.listenToBoard({
      onHover: (tile) => {
        if (!this.showPieceInfo(tile)) this.pieceInfo.hide();
        if (this.phase.kind !== "building") return;
        this.view.showPlacementCursor(
          tile,
          tile !== null &&
            checkPlacement(this.maze, tile, this.chosenPiece) === null,
        );
      },
      onTap: (tile, kind) => {
        // Tapping a Piece asks what it does; on touch that is the only way to ask.
        if (this.showPieceInfo(tile)) return;
        this.pieceInfo.hide();
        if (this.phase.kind !== "building") return;
        const result = placePiece(this.maze, tile, this.chosenPiece);
        if (!result.ok) {
          this.logger.info("placement refused", {
            tile,
            refusal: result.refusal,
          });
          hud.showRefusal(result.refusal);
          return;
        }
        this.maze = result.maze;
        this.logger.debug("Piece placed", { tile, piece: this.chosenPiece });
        this.view.showMaze(this.maze);
        // The tile under the mouse is now taken; a finger has lifted, so there is no cursor.
        if (kind === "mouse") this.view.showPlacementCursor(tile, false);
      },
    });
    this.build();
  }

  /** Shows the Piece on `tile` in the info panel; false if there is none. */
  private showPieceInfo(tile: Tile | null): boolean {
    const id = tile === null ? undefined : pieceAt(this.maze, tile);
    if (id === undefined) return false;
    this.pieceInfo.show(PIECES[id]);
    return true;
  }

  choosePiece(pieceId: PieceId): void {
    if (this.phase.kind !== "building") return;
    this.chosenPiece = pieceId;
    this.view.choosePiece(pieceId);
    this.hud?.showBuilding(pieceId);
  }

  fight(): void {
    if (this.phase.kind !== "building") return;
    const setup: BattleSetup = {
      maze: this.maze,
      army: this.scene.army,
      seed: this.seed,
      rules: this.scene.rules,
    };
    this.logger.info("battle started", {
      seed: setup.seed,
      pieces: this.maze.pieces.size,
      squads: setup.army.length,
    });
    this.view.showPlacementCursor(null, false);
    this.view.showRoute(false);
    const stop = this.view.everyFrame((elapsedMs) => {
      this.watchFrame(elapsedMs);
    });
    this.phase = {
      kind: "fighting",
      setup,
      state: startBattle(setup),
      carryMs: 0,
      kills: 0,
      reachedGoal: 0,
      stop,
    };
    this.hud?.showBattle(this.watchSpeed);
    this.showBattle(this.phase.state, []);
  }

  setWatchSpeed(speed: WatchSpeed): void {
    this.watchSpeed = speed;
    if (this.phase.kind === "fighting") this.hud?.showBattle(speed);
  }

  /** Back to building on the same Maze: nothing on the Board despawns. */
  build(): void {
    if (this.phase.kind === "fighting") return;
    this.phase = { kind: "building" };
    this.view.clearBattle();
    this.view.showMaze(this.maze);
    this.view.showRoute(true);
    this.view.showGoalHealth(
      this.scene.rules.goalHealth,
      this.scene.rules.goalHealth,
    );
    this.hud?.showBuilding(this.chosenPiece);
  }

  private watchFrame(elapsedMs: number): void {
    const phase = this.phase;
    if (phase.kind !== "fighting") return;
    const due = stepsDue(phase.carryMs, elapsedMs, this.watchSpeed);
    phase.carryMs = due.carryMs;
    const ran = stepBattleTimes(phase.setup, phase.state, due.steps);
    phase.state = ran.state;
    for (const event of ran.events) {
      if (event.type === "kill") phase.kills++;
      if (event.type === "reach-goal") phase.reachedGoal++;
    }
    this.showBattle(
      ran.state,
      ran.events.filter((event): event is ShotEvent => event.type === "shot"),
    );
    const outcome = ran.state.outcome;
    if (outcome === null) return;

    phase.stop();
    this.phase = { kind: "finished" };
    this.logger.info("battle finished", {
      ...outcome,
      goalHealth: ran.state.goalHealth,
      kills: phase.kills,
      reachedGoal: phase.reachedGoal,
    });
    this.hud?.showOutcome(outcome);
  }

  private showBattle(state: BattleState, newShots: readonly ShotEvent[]): void {
    this.view.showBattle(state, newShots);
    this.view.showGoalHealth(state.goalHealth, this.scene.rules.goalHealth);
    this.hud?.showBattleStatus(
      state.goalHealth,
      this.scene.rules.goalHealth,
      state.step / STEPS_PER_SECOND,
    );
  }
}
