import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  LinearSRGBColorSpace,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import type { Surface, World } from "../../world/world";

/**
 * How light each surface is before lighting, 0 to 1. Colours are set as linear values and
 * the render target stays linear, so these come back out as the brightness grid on flat ground.
 */
const SURFACE_BRIGHTNESS: Record<Surface, number> = {
  runway: 0.97,
  grass: 0.45,
  hill: 0.5,
  lake: 0.25,
};
/** The sky is left blank, so the horizon is a clear edge. */
const SKY_BRIGHTNESS = 0.03;

/** Metres between terrain vertices: fine enough for the lake's shore, small enough to build fast. */
const TERRAIN_SPACING = 50;
/** The Runway is drawn just above the grass so the two never flicker into each other. */
const RUNWAY_LIFT = 0.3;

/** Sun from the south-east, so hill faces towards the Runway are lit and the far sides are dim. */
const SUN_AZIMUTH = (135 * Math.PI) / 180;
const SUN_ELEVATION = (35 * Math.PI) / 180;
/**
 * Light from all around, and the sun's share; together they light flat ground exactly 1.
 * three.js's Lambert shading divides by pi, so both are scaled up by pi to undo it.
 */
const AMBIENT = 0.45;
const AMBIENT_INTENSITY = AMBIENT * Math.PI;
const SUN_INTENSITY = ((1 - AMBIENT) / Math.sin(SUN_ELEVATION)) * Math.PI;
/** Far hills fade towards the sky colour, which helps tell near from far. */
const FOG_NEAR = 6_000;
const FOG_FAR = 30_000;

/**
 * Three.js axes: x east, y up, z south (so north is -z, where an unrotated camera looks).
 * Every World point goes through this when it becomes a three.js position.
 */
export function toSceneZ(northMetres: number): number {
  return -northMetres;
}

/** The World as a three.js scene: terrain coloured by surface, the Runway, the sky and the sun. */
export function buildWorldScene(world: World): Scene {
  const scene = new Scene();
  const sky = grey(SKY_BRIGHTNESS);
  scene.background = sky;
  scene.fog = new Fog(sky, FOG_NEAR, FOG_FAR);
  scene.add(new AmbientLight(0xffffff, AMBIENT_INTENSITY));
  const sun = new DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(
    Math.sin(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION),
    Math.sin(SUN_ELEVATION),
    toSceneZ(Math.cos(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION)),
  );
  scene.add(sun);
  scene.add(buildTerrain(world));
  scene.add(buildRunway(world));
  return scene;
}

function buildTerrain(world: World): Mesh {
  const cellsPerSide = Math.ceil((world.halfSize * 2) / TERRAIN_SPACING);
  const verticesPerSide = cellsPerSide + 1;
  const positions = new Float32Array(verticesPerSide * verticesPerSide * 3);
  const colours = new Float32Array(verticesPerSide * verticesPerSide * 3);
  for (let row = 0; row < verticesPerSide; row++) {
    for (let column = 0; column < verticesPerSide; column++) {
      const x = -world.halfSize + column * TERRAIN_SPACING;
      const y = -world.halfSize + row * TERRAIN_SPACING;
      const vertex = (row * verticesPerSide + column) * 3;
      positions.set([x, world.groundHeight(x, y), toSceneZ(y)], vertex);
      // The Runway is its own mesh; the ground under it reads as grass.
      const surface = world.surfaceAt(x, y);
      const brightness =
        SURFACE_BRIGHTNESS[surface === "runway" ? "grass" : surface];
      colours.set([brightness, brightness, brightness], vertex);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < cellsPerSide; row++) {
    for (let column = 0; column < cellsPerSide; column++) {
      const southWest = row * verticesPerSide + column;
      const southEast = southWest + 1;
      const northWest = southWest + verticesPerSide;
      const northEast = northWest + 1;
      // Counter-clockwise seen from above, so the faces point up.
      indices.push(southWest, southEast, northWest);
      indices.push(southEast, northEast, northWest);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
}

function buildRunway(world: World): Mesh {
  const { runway } = world;
  const geometry = new PlaneGeometry(runway.width, runway.length);
  // PlaneGeometry stands upright facing +z; lay it flat facing up, its length along north.
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshLambertMaterial({
    color: grey(SURFACE_BRIGHTNESS.runway),
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.set(
    runway.x,
    runway.elevation + RUNWAY_LIFT,
    toSceneZ(runway.y),
  );
  mesh.rotation.y = -runway.heading;
  return mesh;
}

function grey(brightness: number): Color {
  return new Color().setRGB(
    brightness,
    brightness,
    brightness,
    LinearSRGBColorSpace,
  );
}
