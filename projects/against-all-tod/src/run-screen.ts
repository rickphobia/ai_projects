import { soundsOf } from "./adapters/audio/sound-level";
import type { GameSounds } from "./adapters/audio/sound-player";
import type { GameView } from "./adapters/renderer/game-renderer";
import { isSpawnZonePoint, nextStroke } from "./battle/army";
import {
  armyDudes,
  STEPS_PER_SECOND,
  startBattle,
  stepBattleTimes,
  type BattleOutcome,
  type BattleSetup,
  type BattleState,
  type Side,
} from "./battle/battle";
import type { BattleEvent, BoardPoint, ShotEvent } from "./battle/events";
import { stepsDue, type WatchSpeed } from "./battle/watch-clock";
import { BATTLE_RULES } from "./catalog/battle-rules";
import { DUDE_KINDS_ON_SALE, type DudeKindId } from "./catalog/dudes";
import { PIECES, type PieceId } from "./catalog/pieces";
import type { SliderId } from "./catalog/tricks";
import { giveGold, jumpToRound } from "./debug/debug-options";
import { goldEarned, type BattleEnd } from "./economy/economy";
import type { Logger } from "./logger";
import type { Tile } from "./maze/board";
import { pieceAt, type Maze } from "./maze/maze";
import {
  applyRunAction,
  battleSetupOf,
  checkPiece,
  currentSliders,
  dudesUnder,
  canPaintKind,
  mazeOf,
  roundOf,
  runStatusOf,
  sideOf,
  sliderPriceNow,
  windowSizeOf,
  type RunAction,
  type RunState,
} from "./run/run";
import type { CratePanel } from "./ui/crate";
import type { EndScreen } from "./ui/end-screen";
import type { Hud } from "./ui/hud";
import type { PieceInfo } from "./ui/piece-info";
import { roundReport, type RoundReportPanel } from "./ui/report";
import type { SettingsMenu } from "./ui/settings";
import type { ShopStock } from "./ui/shop";

/** What the shop sells each side until Unlocks arrive. */
export const SHOP_STOCK: ShopStock = {
  pieces: ["crate-wall", "sniper-nest"],
  dudeKinds: DUDE_KINDS_ON_SALE,
};
/** The Piece chosen when the page opens. */
export const FIRST_BUILD_PIECE: PieceId = "crate-wall";
const FIRST_DUDE_KIND: DudeKindId = "intern";

interface Battle {
  /** Replaced when a slider is dragged mid-battle, to carry the new input. */
  setup: BattleSetup;
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
  /** The pause menu is open: the battle stands still. */
  private paused = false;
  private battle: Battle | null = null;
  private hud: Hud | undefined;
  private endScreen: EndScreen | undefined;
  private cratePanel: CratePanel | undefined;
  private report: RoundReportPanel | undefined;
  private settings: SettingsMenu | undefined;
  /** The route preview; the debug options can hide it. */
  private routeVisible = true;
  /** The Stroke being painted; null when no paint drag is under way. */
  private stroke: number | null = null;
  /** Whether the Stroke under way has painted or erased anything, so it needs saving. */
  private strokeChanged = false;
  /** The eraser is chosen instead of a Dude kind. */
  private erasing = false;

  /** `run` is a new or loaded Run; `onRunChanged` saves it after every accepted action. */
  constructor(
    private readonly view: GameView,
    private readonly pieceInfo: PieceInfo,
    private readonly logger: Logger,
    run: RunState,
    private readonly onRunChanged: (run: RunState) => void,
    private readonly sounds: GameSounds,
  ) {
    this.run = run;
    this.maze = mazeOf(this.run.pieces, windowSizeOf(this.run));
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
    settings: SettingsMenu,
  ): void {
    this.report = report;
    this.settings = settings;
    this.hud = hud;
    this.endScreen = endScreen;
    this.cratePanel = cratePanel;
    this.view.listenToBoard({
      onHover: (tile) => {
        if (!this.showPieceInfo(tile)) this.pieceInfo.hide();
        if (this.run.phase !== "building") return;
        // Dudes are painted, not placed on tiles, so only the Defense turn has a tile cursor.
        if (sideOf(this.run) === "attack") return;
        this.view.showPlacementCursor(
          tile,
          tile !== null &&
            checkPiece(this.run, tile, this.chosenPiece) === null,
        );
      },
      onTap: (tile, kind) => {
        // Tapping a Piece asks what it does; on touch that is the only way to ask.
        if (this.showPieceInfo(tile)) return;
        this.pieceInfo.hide();
        if (this.run.phase !== "building" || sideOf(this.run) === "attack") {
          return;
        }
        const placed = this.act({
          type: "place-piece",
          tile,
          pieceId: this.chosenPiece,
        });
        if (!placed) return;
        // The tile under the mouse is now taken; a finger has lifted, so there is no cursor.
        if (kind === "mouse") this.view.showPlacementCursor(tile, false);
      },
      paint: {
        canPaintAt: (at) =>
          this.run.phase === "building" &&
          sideOf(this.run) === "attack" &&
          isSpawnZonePoint(at, windowSizeOf(this.run)),
        onPaintStart: (at) => {
          this.stroke = nextStroke(this.run.army);
          this.paintAt(at, true);
        },
        onPaintMove: (at) => {
          this.paintAt(at, false);
        },
        onPaintEnd: () => {
          this.endStroke();
        },
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
    this.erasing = false;
    this.showBuilding();
  }

  chooseEraser(): void {
    if (this.run.phase !== "building") return;
    this.erasing = true;
    this.showBuilding();
  }

  /** Takes crate item `index`; a Piece or Squad becomes the chosen one, ready to place for free. */
  takeFromCrate(index: number): void {
    if (!this.act({ type: "take-from-crate", index })) return;
    const free = this.run.freeItem;
    if (free?.kind === "piece") this.chosenPiece = free.id;
    if (free?.kind === "gift") this.chosenDudeKind = free.id;
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

  /** Drags a Settings slider; mid-battle the drag takes effect from the next step. */
  dragSlider(slider: SliderId, to: number): void {
    const battle = this.battle;
    const atStep = battle === null ? 0 : battle.state.step + 1;
    const accepted = this.act({ type: "drag-slider", slider, to, atStep });
    if (accepted) {
      if (battle !== null) {
        battle.setup = {
          ...battle.setup,
          sliderInputs: this.run.sliderInputs,
        };
      }
      this.logger.info("slider dragged", {
        round: roundOf(this.run),
        side: sideOf(this.run),
        slider,
        to,
        midBattle: battle !== null,
        atStep: battle === null ? null : atStep,
        wallets: this.run.wallets,
      });
      this.showRunStatus();
      // The Board changed shape: lanes, crushed Pieces, squeezed Dudes.
      if (slider === "window-size") this.showBuilding();
    }
    // A refused drag snaps the slider back.
    this.showTricks();
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
      dudes: setup.army.length,
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
    this.showTricks();
    this.showBattle(this.battle.state, []);
  }

  setWatchSpeed(speed: WatchSpeed): void {
    this.watchSpeed = speed;
    if (this.battle !== null) this.hud?.showBattle(sideOf(this.run), speed);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
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
    const windowSize = windowSizeOf(result.state);
    if (
      result.state.pieces !== this.run.pieces ||
      windowSize !== windowSizeOf(this.run)
    ) {
      this.maze = mazeOf(result.state.pieces, windowSize);
    }
    this.run = result.state;
    this.onRunChanged(this.run);
    if (action.type === "place-piece") {
      this.logger.debug("placed", { ...action });
      this.showBuilding();
    }
    return true;
  }

  /**
   * Paints one Dude of the brush at `at`. The Run is saved once the Stroke ends, not per Dude.
   * Mid-Stroke, a spot with no room or outside the zone is skipped quietly: a stroke over the
   * crowd or past the edge is normal. Other refusals (gold run out) are shown.
   */
  private paintAt(at: BoardPoint, first: boolean): void {
    if (this.stroke === null) return;
    if (this.erasing) {
      this.eraseAt(at);
      return;
    }
    const action: RunAction = {
      type: "paint-dude",
      dudeKind: this.chosenDudeKind,
      at,
      stroke: this.stroke,
    };
    const result = applyRunAction(this.run, action);
    if (!result.ok) {
      const quiet =
        !first &&
        (result.refusal === "no-room" || result.refusal === "not-spawn-zone");
      if (!quiet) {
        this.logger.debug("paint refused", { refusal: result.refusal });
        this.hud?.showRefusal(result.refusal);
      }
      return;
    }
    this.run = result.state;
    this.strokeChanged = true;
    this.showArmy();
  }

  /** Erases or Dismisses every Dude under the eraser at `at`, last painted first so indexes hold. */
  private eraseAt(at: BoardPoint): void {
    const under = dudesUnder(this.run.army, at);
    if (under.length === 0) return;
    for (const index of under.reverse()) {
      const result = applyRunAction(this.run, { type: "erase-dude", index });
      if (!result.ok) {
        this.logger.debug("erase refused", { refusal: result.refusal });
        this.hud?.showRefusal(result.refusal);
        return;
      }
      this.run = result.state;
      this.strokeChanged = true;
    }
    this.showArmy();
  }

  private endStroke(): void {
    const stroke = this.stroke;
    this.stroke = null;
    const changed = this.strokeChanged;
    this.strokeChanged = false;
    if (stroke === null || !changed) return;
    this.onRunChanged(this.run);
    if (this.erasing) {
      this.logger.debug("Stroke erased", {
        dudes: this.run.army.length,
        attackGold: this.run.wallets.attack,
      });
      return;
    }
    const painted = this.run.army.filter((dude) => dude.stroke === stroke);
    this.logger.debug("Stroke painted", {
      stroke,
      dudeKind: this.chosenDudeKind,
      dudes: painted.length,
      attackGold: this.run.wallets.attack,
    });
  }

  /** The Army where it stands, the wallets and the unit bar: what painting a Dude changes. */
  private showArmy(): void {
    const round = roundOf(this.run);
    // While erasing, older Dudes fade: Erasing them is a Dismiss, with nothing back.
    const dimmed =
      this.erasing && sideOf(this.run) === "attack"
        ? new Set(
            this.run.army.flatMap((dude, index) =>
              dude.round === round ? [] : [index],
            ),
          )
        : new Set<number>();
    this.view.showArmy(
      armyDudes(this.run.army, this.run.mutations, windowSizeOf(this.run)),
      dimmed,
    );
    this.showRunStatus();
    if (this.run.phase === "building") {
      this.cratePanel?.show(
        this.run.crate,
        this.run.freeItem,
        sideOf(this.run),
      );
    }
    if (sideOf(this.run) === "attack") {
      // A brush whose free gift ran out goes back to one the shop sells.
      if (!canPaintKind(this.run, this.chosenDudeKind)) {
        this.chosenDudeKind = FIRST_DUDE_KIND;
      }
      this.hud?.showAttackBuilding(
        this.chosenDudeKind,
        this.run.freeItem,
        this.erasing,
      );
    }
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
    this.view.showGoalHealth(BATTLE_RULES.goalHealth, BATTLE_RULES.goalHealth);
    this.showTricks();
    if (this.run.phase !== "building") this.cratePanel?.hide();
    this.showArmy();
    if (sideOf(this.run) === "defense") {
      this.view.choosePiece(this.chosenPiece);
      this.hud?.showDefenseBuilding(this.chosenPiece);
    } else {
      this.view.showPlacementCursor(null, false);
    }
  }

  /** The sliders in the Settings menu and on the Board. */
  private showTricks(): void {
    const sliders = currentSliders(this.run);
    this.view.showTricks(sliders);
    this.sounds.setVolumeTrick(sliders.volume);
    this.settings?.show(
      sliders,
      sideOf(this.run),
      this.run.phase === "fighting",
      (slider, to) => sliderPriceNow(this.run, slider, to),
    );
  }

  private showRunStatus(): void {
    this.hud?.showRunStatus(runStatusOf(this.run));
  }

  private watchFrame(elapsedMs: number): void {
    const battle = this.battle;
    if (battle === null || this.paused) return;
    const due = stepsDue(battle.carryMs, elapsedMs, this.watchSpeed);
    battle.carryMs = due.carryMs;
    const ran = stepBattleTimes(battle.setup, battle.state, due.steps);
    battle.state = ran.state;
    this.sounds.play(soundsOf(ran.events));
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
      survivors: end.dudes.map((dude) => dude.kind),
      mutations: battle.setup.mutations,
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
    this.sounds.play(earned[side] > 0 ? ["round-end", "gold"] : ["round-end"]);
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
    this.showTricks();
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
