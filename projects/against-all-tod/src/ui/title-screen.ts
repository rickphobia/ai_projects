import { seedFromUrl } from "../debug/debug-options";
import { wantsSwarmScene } from "../debug/swarm-scene";
import { newRun, type RunState } from "../run/run";

/** How long a screen takes to fade; matches `--screen-ms` in index.html. */
export const SCREEN_TRANSITION_MS = 250;

export type TitleChoice = "play" | "new-run";

/** A plain visit gets the title screen; a seeded link or the swarm screen goes straight in. */
export function wantsTitleScreen(search: string): boolean {
  return seedFromUrl(search) === null && !wantsSwarmScene(search);
}

/** A saved Run that isn't over yet, so Play has something to continue. */
export function canContinue(savedRun: RunState | null): boolean {
  return savedRun !== null && savedRun.phase !== "run-over";
}

/**
 * The Run a title screen choice starts. Play continues the saved Run; New Run, or Play after a
 * finished Run, starts the next seed with the best Score kept, as the end screen's New Run does.
 */
export function runForTitleChoice(
  choice: TitleChoice,
  savedRun: RunState | null,
  defaultSeed: number,
): RunState {
  if (savedRun === null) return newRun(defaultSeed, 0, true);
  if (choice === "play" && canContinue(savedRun)) return savedRun;
  return newRun(savedRun.seed + 1, savedRun.bestScore, false);
}

export function titleBestScore(bestScore: number): string {
  return bestScore > 0
    ? `Best Score ${String(bestScore)}`
    : "No best Score yet";
}

/**
 * The game's front door. The logo is drawn in index.html; this adds the best Score, a big Play
 * and, beside a Run worth continuing, a smaller New Run.
 */
export class TitleScreen {
  constructor(private readonly host: HTMLElement) {}

  /** Shows the title screen and resolves with the player's choice once it has faded out. */
  choose(bestScore: number, offerNewRun: boolean): Promise<TitleChoice> {
    const doc = this.host.ownerDocument;
    const best = doc.createElement("p");
    best.className = "chip";
    best.textContent = titleBestScore(bestScore);
    const play = doc.createElement("button");
    play.type = "button";
    play.className = "btn title-play";
    play.textContent = "Play";
    const buttons = doc.createElement("div");
    buttons.className = "title-buttons";
    buttons.append(play);
    const newRunButton = doc.createElement("button");
    if (offerNewRun) {
      newRunButton.type = "button";
      newRunButton.className = "btn";
      newRunButton.textContent = "New Run";
      buttons.append(newRunButton);
    }
    this.host.querySelector(".title-menu")?.replaceChildren(best, buttons);
    this.host.hidden = false;
    play.focus();
    return new Promise((resolve) => {
      const pick = (choice: TitleChoice): void => {
        play.disabled = true;
        newRunButton.disabled = true;
        this.host.classList.add("leaving");
        window.setTimeout(() => {
          this.host.hidden = true;
          resolve(choice);
        }, SCREEN_TRANSITION_MS);
      };
      play.addEventListener("click", () => {
        pick("play");
      });
      newRunButton.addEventListener("click", () => {
        pick("new-run");
      });
    });
  }
}
