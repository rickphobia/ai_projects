import { describe, expect, it } from "vitest";
import { cockpitCameraOnRunway } from "../../src/world/cockpit-camera";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);

describe("World", () => {
  it("is about 20 x 20 km", () => {
    expect(world.halfSize * 2).toBeGreaterThanOrEqual(18_000);
    expect(world.halfSize * 2).toBeLessThanOrEqual(22_000);
  });

  it("has flat runway at the Runway's centre and both ends", () => {
    const { runway } = world;
    const halfLength = runway.length / 2 - 1;
    for (const along of [-halfLength, 0, halfLength]) {
      expect(world.surfaceAt(runway.x, runway.y + along)).toBe("runway");
      expect(world.groundHeight(runway.x, runway.y + along)).toBe(
        runway.elevation,
      );
    }
  });

  it("has grass just beside the Runway", () => {
    const { runway } = world;
    expect(world.surfaceAt(runway.x + runway.width, runway.y)).toBe("grass");
  });

  it("has lake at the lake's centre, at the water level", () => {
    const { lake } = world;
    expect(world.surfaceAt(lake.x, lake.y)).toBe("lake");
    expect(world.groundHeight(lake.x, lake.y)).toBe(lake.waterLevel);
  });

  it("has hill at the top of each hill, well above the Runway", () => {
    for (const hill of world.hills) {
      expect(world.surfaceAt(hill.x, hill.y)).toBe("hill");
      expect(world.groundHeight(hill.x, hill.y)).toBeGreaterThan(
        world.runway.elevation + 100,
      );
    }
  });

  it("treats points outside the World as grass at the base height", () => {
    const outside = world.halfSize + 500;
    expect(world.surfaceAt(outside, outside)).toBe("grass");
    expect(Number.isFinite(world.groundHeight(outside, 0))).toBe(true);
  });
});

describe("cockpitCameraOnRunway", () => {
  it("sits on the Runway, a pilot's eye height above it, facing along it", () => {
    const pose = cockpitCameraOnRunway(world);
    expect(world.surfaceAt(pose.x, pose.y)).toBe("runway");
    const eyeHeight = pose.height - world.groundHeight(pose.x, pose.y);
    expect(eyeHeight).toBeGreaterThan(1);
    expect(eyeHeight).toBeLessThan(3);
    expect(pose.heading).toBe(world.runway.heading);
  });
});
