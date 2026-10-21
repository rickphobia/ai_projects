/**
 * The World as data: ground height and surface type at any point. Coordinates are metres,
 * `x` east and `y` north, with the World centred on (0, 0); heights are metres above the
 * base ground level. Both the game and the 3D view read the World from here, so what the
 * player sees and what the Plane touches can't disagree.
 */

export type Surface = "runway" | "grass" | "hill" | "lake";

export interface Runway {
  /** Centre of the Runway. */
  x: number;
  y: number;
  length: number;
  width: number;
  /** Direction the Runway points, in radians clockwise from north. */
  heading: number;
  elevation: number;
}

/**
 * An elliptical lake, flat at its water level, with its axes along east and north. The
 * ground climbs from the water back to the base height in a straight bank `bankWidth` wide,
 * so the lake sits in a hollow that can be seen from the Runway rather than hidden behind a lip.
 */
export interface Lake {
  x: number;
  y: number;
  radiusEast: number;
  radiusNorth: number;
  waterLevel: number;
  bankWidth: number;
}

/** A round hill, highest at its centre and falling smoothly to base ground level at its radius. */
export interface Hill {
  x: number;
  y: number;
  radius: number;
  height: number;
}

export interface WorldLayout {
  /** The World runs from -halfSize to +halfSize in both x and y. */
  halfSize: number;
  /** Height of flat grass and anywhere outside the hills and the lake. */
  baseHeight: number;
  /** Ground counts as hill once the hills raise it this far above the base height. */
  hillThreshold: number;
  runway: Runway;
  lake: Lake;
  hills: readonly Hill[];
}

export interface World extends WorldLayout {
  /** Height of the surface at a point: the water surface on the lake, the ground elsewhere. */
  groundHeight(x: number, y: number): number;
  surfaceAt(x: number, y: number): Surface;
  /** Metres from the nearest point of the Runway's centreline, the line down its middle from end to end. */
  centrelineDistance(x: number, y: number): number;
}

export function createWorld(layout: WorldLayout): World {
  return {
    ...layout,
    groundHeight: (x, y) => groundHeight(layout, x, y),
    surfaceAt: (x, y) => surfaceAt(layout, x, y),
    centrelineDistance: (x, y) => centrelineDistance(layout.runway, x, y),
  };
}

function groundHeight(layout: WorldLayout, x: number, y: number): number {
  if (isOnRunway(layout.runway, x, y)) return layout.runway.elevation;
  if (isInLake(layout.lake, x, y)) return layout.lake.waterLevel;
  return lakeBankHeight(layout, x, y) + hillRise(layout.hills, x, y);
}

function surfaceAt(layout: WorldLayout, x: number, y: number): Surface {
  if (isOnRunway(layout.runway, x, y)) return "runway";
  if (isInLake(layout.lake, x, y)) return "lake";
  if (hillRise(layout.hills, x, y) > layout.hillThreshold) return "hill";
  return "grass";
}

function isOnRunway(runway: Runway, x: number, y: number): boolean {
  const { along, across } = inRunwayFrame(runway, x, y);
  return (
    Math.abs(along) <= runway.length / 2 && Math.abs(across) <= runway.width / 2
  );
}

function centrelineDistance(runway: Runway, x: number, y: number): number {
  const { along, across } = inRunwayFrame(runway, x, y);
  const pastEnd = Math.max(0, Math.abs(along) - runway.length / 2);
  return Math.hypot(across, pastEnd);
}

/** A point in the Runway's own frame: metres along its length and across it from its centre. */
function inRunwayFrame(
  runway: Runway,
  x: number,
  y: number,
): { along: number; across: number } {
  const east = x - runway.x;
  const north = y - runway.y;
  return {
    along: east * Math.sin(runway.heading) + north * Math.cos(runway.heading),
    across: east * Math.cos(runway.heading) - north * Math.sin(runway.heading),
  };
}

function isInLake(lake: Lake, x: number, y: number): boolean {
  return lakeRadius(lake, x, y) <= 1;
}

/** How far out from the lake's centre a point is: 1 on the shore, 2 twice as far out. */
function lakeRadius(lake: Lake, x: number, y: number): number {
  return Math.hypot(
    (x - lake.x) / lake.radiusEast,
    (y - lake.y) / lake.radiusNorth,
  );
}

/** The ground height before hills: the base height, sloping down to the water near the lake. */
function lakeBankHeight(layout: WorldLayout, x: number, y: number): number {
  const { lake, baseHeight } = layout;
  const radius = lakeRadius(lake, x, y);
  // Distance from the shore along the line from the lake's centre: exact on the axes, close elsewhere.
  const fromShore = Math.hypot(x - lake.x, y - lake.y) * (1 - 1 / radius);
  if (fromShore >= lake.bankWidth) return baseHeight;
  return (
    lake.waterLevel +
    ((baseHeight - lake.waterLevel) * fromShore) / lake.bankWidth
  );
}

/** How far the hills raise the ground at a point. Overlapping hills add up. */
function hillRise(hills: readonly Hill[], x: number, y: number): number {
  let rise = 0;
  for (const hill of hills) {
    const distance = Math.hypot(x - hill.x, y - hill.y);
    if (distance >= hill.radius) continue;
    // A raised cosine: flat on top, flat at the foot, no step anywhere.
    rise +=
      hill.height * (0.5 + 0.5 * Math.cos((Math.PI * distance) / hill.radius));
  }
  return rise;
}
