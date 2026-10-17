import { describe, expect, it } from "vitest";
import { fitToView } from "../../../src/adapters/renderer/fit-to-view";

describe("fitToView", () => {
  it("scales a wide view by its height and centres the Board sideways", () => {
    const fit = fitToView(
      { width: 2000, height: 1000 },
      { width: 1000, height: 500 },
      0,
    );
    expect(fit).toEqual({ scale: 2, x: 0, y: 0 });

    const wide = fitToView(
      { width: 3000, height: 1000 },
      { width: 1000, height: 500 },
      0,
    );
    expect(wide).toEqual({ scale: 2, x: 500, y: 0 });
  });

  it("scales a tall view by its width and centres the Board up and down", () => {
    const fit = fitToView(
      { width: 500, height: 1000 },
      { width: 1000, height: 500 },
      0,
    );
    expect(fit).toEqual({ scale: 0.5, x: 0, y: 375 });
  });

  it("leaves the margin free on the tighter side", () => {
    const fit = fitToView(
      { width: 1020, height: 1000 },
      { width: 1000, height: 500 },
      10,
    );
    expect(fit).toEqual({ scale: 1, x: 10, y: 250 });
  });

  it("never returns a zero or negative scale for a tiny view", () => {
    const fit = fitToView(
      { width: 10, height: 10 },
      { width: 1000, height: 500 },
      20,
    );
    expect(fit.scale).toBeGreaterThan(0);
  });
});
