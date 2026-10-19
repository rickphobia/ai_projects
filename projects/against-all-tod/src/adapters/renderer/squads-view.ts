import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { Army } from "../../battle/army";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { ATTACK_COLOUR } from "./board-view";

/** Kenney's sprites face up; Squads face right, into the Board. */
const FACING_RIGHT = Math.PI / 2;

/**
 * One Squad as a token in a tile-sized box with its top left at (0, 0): a Dude on a disc in the
 * attack colour, with the Squad's size, so a Spawn zone tile reads as "20 Interns start here".
 */
export function squadView(
  textures: BoardTextures,
  dudeKind: DudeKindId,
): Container {
  const squad = new Container({ label: `squad-${dudeKind}` });
  const disc = new Graphics()
    .circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.4)
    .fill({ color: ATTACK_COLOUR })
    .stroke({ color: 0xffffff, alpha: 0.7, width: 3 });
  const dude = new Sprite({
    texture: textures.dude,
    anchor: 0.5,
    rotation: FACING_RIGHT,
    x: TILE_SIZE / 2,
    y: TILE_SIZE / 2,
  });
  const size = new Text({
    text: `×${String(DUDE_KINDS[dudeKind].squadSize)}`,
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 18,
      fontWeight: "700",
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
    },
    anchor: { x: 1, y: 1 },
    x: TILE_SIZE - 2,
    y: TILE_SIZE,
  });
  squad.addChild(disc, dude, size);
  return squad;
}

/** Every Squad in the Army on its Spawn zone tile. Redrawn whole: the zone has one Squad per tile at most. */
export function drawSquads(
  layer: Container,
  textures: BoardTextures,
  army: Army,
): void {
  for (const child of layer.removeChildren()) child.destroy({ children: true });
  for (const { dudeKind, tile } of army) {
    const squad = squadView(textures, dudeKind);
    squad.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    layer.addChild(squad);
  }
}
