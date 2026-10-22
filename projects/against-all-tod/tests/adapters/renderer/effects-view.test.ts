import { Container, Sprite, Texture, type Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { ShotEvent } from "../../../src/battle/events";
import { drawEffectTextures } from "../../../src/adapters/renderer/effect-art";
import {
  BONK_GAP_MS,
  BULLET_MS,
  BURST_MS,
} from "../../../src/adapters/renderer/effect-motion";
import { EffectsView } from "../../../src/adapters/renderer/effects-view";
import { tileKey } from "../../../src/maze/board";
import { emptyMaze, placePiece, removePiece } from "../../../src/maze/maze";

// Stands in for the renderer: every bake is a fresh texture, so each effect's sprites can be told apart.
const textures = drawEffectTextures((shape: Graphics) => {
  shape.destroy();
  return new Texture();
});
const wallTile = { column: 8, row: 5 };
const placed = placePiece(emptyMaze(), wallTile, "crate-wall");
if (!placed.ok) throw new Error("the test wall can't be placed");
const maze = placed.maze;
const key = tileKey(wallTile);

/** How many sprites showing `texture` are on screen. */
function showing(view: Container, texture: Texture): number {
  return view.children.reduce((count, child) => {
    if (!child.visible) return count;
    if (child instanceof Sprite && child.texture === texture) return count + 1;
    return child instanceof Container ? count + showing(child, texture) : count;
  }, 0);
}

function hitTo(health: number) {
  return { maze, pieceHealth: new Map([[key, health]]) };
}

describe("EffectsView", () => {
  it("flies a bullet for each shot, then puffs where it lands and clears", () => {
    const effects = new EffectsView(textures);
    const shot: ShotEvent = {
      type: "shot",
      step: 1,
      pieceId: "sniper-nest",
      pieceTile: { column: 3, row: 3 },
      dudeId: 1,
      at: { x: 6, y: 3.5 },
    };
    effects.showBattle({ maze, pieceHealth: new Map() }, [shot]);
    expect(showing(effects.view, textures.bullet)).toBe(1);
    effects.tick(BULLET_MS);
    expect(showing(effects.view, textures.bullet)).toBe(0);
    expect(showing(effects.view, textures.starPuff)).toBe(1);
    effects.tick(BURST_MS);
    expect(showing(effects.view, textures.starPuff)).toBe(0);
  });

  it("bonks a hit Piece at most once per gap, so a chewing Termite doesn't flood the screen", () => {
    const effects = new EffectsView(textures);
    effects.showBattle({ maze, pieceHealth: new Map() }, []);
    effects.showBattle(hitTo(90), []);
    expect(showing(effects.view, textures.bonk)).toBe(1);
    effects.tick(BURST_MS);
    effects.showBattle(hitTo(80), []);
    expect(showing(effects.view, textures.bonk)).toBe(0);
    effects.tick(BONK_GAP_MS);
    effects.showBattle(hitTo(70), []);
    expect(showing(effects.view, textures.bonk)).toBe(1);
  });

  it("always bonks the Piece that falls", () => {
    const effects = new EffectsView(textures);
    effects.showBattle(hitTo(10), []);
    effects.tick(BURST_MS);
    effects.showBattle(
      { maze: removePiece(maze, wallTile), pieceHealth: new Map() },
      [],
    );
    expect(showing(effects.view, textures.bonk)).toBe(1);
  });

  it("drops the Goal into rubble until the battle is cleared", () => {
    const effects = new EffectsView(textures);
    effects.breakGoal();
    expect(showing(effects.view, textures.rubble)).toBe(1);
    expect(showing(effects.view, textures.starPuff)).toBeGreaterThan(0);
    effects.clear();
    expect(showing(effects.view, textures.rubble)).toBe(0);
    expect(showing(effects.view, textures.starPuff)).toBe(0);
  });
});
