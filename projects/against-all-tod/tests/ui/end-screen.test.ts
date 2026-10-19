import { describe, expect, it } from "vitest";
import { endScreenScores, endScreenUnlocks } from "../../src/ui/end-screen";

describe("endScreenScores", () => {
  it("shows the Score next to the best Score", () => {
    expect(endScreenScores(4, 6)).toBe("Score 4 · Best Score 6");
  });

  it("calls out a new best Score", () => {
    expect(endScreenScores(7, 6)).toBe("Score 7 · a new best Score!");
  });

  it("doesn't call a tie a new best", () => {
    expect(endScreenScores(6, 6)).toBe("Score 6 · Best Score 6");
  });
});

describe("endScreenUnlocks", () => {
  it("shows the next Unlock and the Score it needs", () => {
    expect(endScreenUnlocks(3, 2)).toBe("Next: Sapper at best Score 5.");
  });

  it("names what a new best Score Unlocked", () => {
    expect(endScreenUnlocks(11, 4)).toBe(
      "Unlocked: Sapper, Bouncer. Next: Mole at best Score 15.",
    );
  });

  it("names nothing new when the best Score didn't move", () => {
    expect(endScreenUnlocks(6, 11)).toBe("Next: Mole at best Score 15.");
  });

  it("says when everything is Unlocked", () => {
    expect(endScreenUnlocks(30, 25)).toBe("Everything is Unlocked.");
  });
});
