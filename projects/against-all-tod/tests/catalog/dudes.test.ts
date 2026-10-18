import { describe, expect, it } from "vitest";
import {
  DUDE_KINDS,
  ROUND_ONE_ARMY,
  type DudeKindId,
} from "../../src/catalog/dudes";
import { BOARD_ROWS } from "../../src/maze/board";

describe("the Dude kind catalog", () => {
  it("files every entry under its own id", () => {
    for (const [id, entry] of Object.entries(DUDE_KINDS)) {
      expect(entry.id).toBe(id as DudeKindId);
    }
  });

  it("has Interns that come 20 to a Squad", () => {
    expect(DUDE_KINDS.intern.squadSize).toBe(20);
  });
});

describe("the Round 1 Army", () => {
  it("puts each Squad on its own Spawn line row", () => {
    const rows = ROUND_ONE_ARMY.map((squad) => squad.spawnRow);
    expect(new Set(rows).size).toBe(rows.length);
    for (const row of rows) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BOARD_ROWS);
    }
  });
});
