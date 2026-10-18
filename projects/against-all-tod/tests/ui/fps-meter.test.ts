import { describe, expect, it } from "vitest";
import { FpsCounter, fpsText } from "../../src/ui/fps-meter";

describe("FpsCounter", () => {
  it("reads 60 fps from half a second of 60 Hz frames", () => {
    const counter = new FpsCounter();
    const readings = Array.from({ length: 30 }, () => counter.frame(1000 / 60));
    expect(readings.slice(0, -1).every((reading) => reading === null)).toBe(
      true,
    );
    expect(readings.at(-1)?.fps).toBeCloseTo(60);
  });

  it("keeps the lowest window after the frame rate recovers", () => {
    const counter = new FpsCounter();
    for (let frame = 0; frame < 10; frame++) counter.frame(50);
    let reading = null;
    for (let frame = 0; frame < 30; frame++) {
      reading = counter.frame(1000 / 60) ?? reading;
    }
    expect(reading?.fps).toBeCloseTo(60);
    expect(reading?.lowestFps).toBeCloseTo(20);
  });
});

describe("fpsText", () => {
  it("rounds to whole frames and names the Dudes on the Board", () => {
    expect(fpsText({ fps: 58.4, lowestFps: 51.6 }, 456)).toBe(
      "58 fps (lowest 52) · 456 Dudes",
    );
  });
});
