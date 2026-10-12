import type { WorldLayout } from "./world";

/**
 * The one hand-made World. The Runway points north from the middle, along the lake's west
 * shore, and hills ring the valley so there is always a landmark in view.
 * Neither the hills nor the lake's bank may reach the Runway: it must stay flat.
 */
export const WORLD_LAYOUT: WorldLayout = {
  halfSize: 10_000,
  baseHeight: 0,
  hillThreshold: 15,
  runway: {
    x: 0,
    y: 0,
    length: 1_000,
    width: 30,
    heading: 0,
    elevation: 0,
  },
  // Right beside the Runway, below a steep bank. From a pilot's eye 2 m up, the first row below
  // the horizon already meets flat ground under 200 m away, so water any further off, or level
  // with the grass, would be hidden; the drop lets the eye see down onto it.
  lake: {
    x: 1_625,
    y: -300,
    radiusEast: 1_500,
    radiusNorth: 2_500,
    waterLevel: -15,
    bankWidth: 85,
  },
  hills: [
    // Ahead of the Runway.
    { x: 400, y: 6_500, radius: 2_200, height: 550 },
    { x: -2_600, y: 4_200, radius: 1_600, height: 380 },
    { x: 4_200, y: 5_200, radius: 1_500, height: 320 },
    // West of the Runway, and east beyond the lake.
    { x: -5_200, y: 300, radius: 2_600, height: 650 },
    { x: 5_600, y: -1_200, radius: 2_100, height: 420 },
    // Behind the Runway.
    { x: -1_600, y: -5_200, radius: 2_200, height: 480 },
    { x: 3_800, y: -6_400, radius: 2_600, height: 520 },
    // The corners, so the World's edge is hidden behind high ground.
    { x: -7_000, y: 7_000, radius: 3_200, height: 900 },
    { x: 7_000, y: 7_400, radius: 3_000, height: 800 },
    { x: -7_400, y: -7_000, radius: 3_000, height: 750 },
    { x: 7_600, y: -7_600, radius: 2_800, height: 700 },
  ],
};
