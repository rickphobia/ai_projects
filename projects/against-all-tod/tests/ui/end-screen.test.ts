import { describe, expect, it } from "vitest";
import { endScreenScores } from "../../src/ui/end-screen";

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
