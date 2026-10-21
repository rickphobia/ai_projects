import { describe, expect, it } from "vitest";
import { cockpitCamera } from "../../src/flight/cockpit-camera";
import { planeOnRunway } from "../../src/flight/plane";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);

describe("cockpitCamera", () => {
  it("starts on the Runway, a pilot's eye height above it, facing along it", () => {
    const pose = cockpitCamera(planeOnRunway(world));
    expect(world.surfaceAt(pose.x, pose.y)).toBe("runway");
    const eyeHeight = pose.height - world.groundHeight(pose.x, pose.y);
    expect(eyeHeight).toBeGreaterThan(1);
    expect(eyeHeight).toBeLessThan(3);
    expect(pose.heading).toBe(world.runway.heading);
  });

  it("looks where the Plane points", () => {
    const plane = {
      ...planeOnRunway(world),
      heading: 1,
      pitch: 0.2,
      roll: -0.3,
    };
    const pose = cockpitCamera(plane);
    expect([pose.heading, pose.pitch, pose.roll]).toEqual([1, 0.2, -0.3]);
  });
});
