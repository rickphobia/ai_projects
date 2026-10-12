import { describe, expect, it } from "vitest";
import { cockpitCameraOnRunway } from "../../src/world/cockpit-camera";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);

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
