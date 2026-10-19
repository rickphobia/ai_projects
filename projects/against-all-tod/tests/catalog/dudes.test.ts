import { describe, expect, it } from "vitest";
import {
  DUDE_KINDS,
  ROUND_ONE_ARMY,
  type DudeKindId,
} from "../../src/catalog/dudes";
import { isInSpawnZone, tileKey } from "../../src/maze/board";

describe("the Dude kind catalog", () => {
  it("files every entry under its own id", () => {
    for (const [id, entry] of Object.entries(DUDE_KINDS)) {
      expect(entry.id).toBe(id as DudeKindId);
    }
  });

  it("describes Interns with their real Squad size", () => {
    const intern = DUDE_KINDS.intern;
    expect(intern.description).toContain(String(intern.squadSize));
  });
});

describe("the Round 1 Army", () => {
  it("puts each Squad on its own Spawn zone tile", () => {
    const tiles = ROUND_ONE_ARMY.map((squad) => tileKey(squad.tile));
    expect(new Set(tiles).size).toBe(tiles.length);
    for (const { tile } of ROUND_ONE_ARMY) {
      expect(isInSpawnZone(tile)).toBe(true);
    }
  });
});
