import { describe, expect, it } from "vitest";
import { applyRunAction, newRun, type RunState } from "../../src/run/run";
import {
  canContinue,
  runForTitleChoice,
  SCREEN_TRANSITION_MS,
  titleBestScore,
  wantsTitleScreen,
} from "../../src/ui/title-screen";

const DEFAULT_SEED = 7;

/** A Run part-way through: Round 1's battle started. */
function runInProgress(): RunState {
  const result = applyRunAction(newRun(42, 6, false), { type: "start-battle" });
  if (!result.ok) throw new Error(result.refusal);
  return result.state;
}

describe("wantsTitleScreen", () => {
  it("shows the title screen on a plain visit", () => {
    expect(wantsTitleScreen("")).toBe(true);
    expect(wantsTitleScreen("?debug=1")).toBe(true);
  });

  it("skips it when the URL carries a seed", () => {
    expect(wantsTitleScreen("?seed=12")).toBe(false);
  });

  it("skips it for the swarm debug screen", () => {
    expect(wantsTitleScreen("?debug=1&scene=swarm")).toBe(false);
  });

  it("still shows it for a seed that isn't one", () => {
    expect(wantsTitleScreen("?seed=abc")).toBe(true);
  });
});

describe("runForTitleChoice", () => {
  it("Play continues the saved Run as it was", () => {
    const saved = runInProgress();
    expect(runForTitleChoice("play", saved, DEFAULT_SEED)).toBe(saved);
  });

  it("New Run starts a fresh Run on the next seed, keeping the best Score", () => {
    const saved = runInProgress();
    expect(runForTitleChoice("new-run", saved, DEFAULT_SEED)).toEqual(
      newRun(43, 6, false),
    );
  });

  it("Play after a finished Run starts the next one", () => {
    const over: RunState = { ...runInProgress(), phase: "run-over" };
    expect(runForTitleChoice("play", over, DEFAULT_SEED)).toEqual(
      newRun(43, 6, false),
    );
  });

  it("with no save, Play starts the first Run on the default seed", () => {
    expect(runForTitleChoice("play", null, DEFAULT_SEED)).toEqual(
      newRun(DEFAULT_SEED, 0, true),
    );
  });
});

describe("title screen labels", () => {
  it("offers New Run only beside a Run worth continuing", () => {
    expect(canContinue(runInProgress())).toBe(true);
    expect(canContinue({ ...runInProgress(), phase: "run-over" })).toBe(false);
    expect(canContinue(null)).toBe(false);
  });

  it("shows the best Score", () => {
    expect(titleBestScore(6)).toBe("Best Score 6");
    expect(titleBestScore(0)).toBe("No best Score yet");
  });

  it("changes screens in under a second", () => {
    expect(SCREEN_TRANSITION_MS).toBeLessThan(1000);
  });
});
