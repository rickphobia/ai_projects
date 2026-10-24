import { describe, expect, it } from "vitest";
import { DUDE_KINDS, type DudeKindId } from "../../src/catalog/dudes";
import { dudeInfoContent } from "../../src/ui/dude-info";

const KINDS = Object.keys(DUDE_KINDS) as DudeKindId[];

describe("dudeInfoContent", () => {
  it.each(KINDS)(
    "reads %s's name, description and stats from the catalogue",
    (id) => {
      const entry = DUDE_KINDS[id];
      const content = dudeInfoContent(entry, entry.dudePrice);
      expect(content.name).toBe(entry.name);
      expect(content.description).toBe(entry.description);
      expect(content.price).toBe(`${String(entry.dudePrice)}g each`);
      const stats = new Map(content.stats.map((s) => [s.label, s.value]));
      expect(stats.get("Health")).toBe(String(entry.health));
      expect(stats.get("Speed")).toBe(`${String(entry.speed)} tiles/s`);
      expect(stats.get("Goal damage")).toBe(String(entry.goalDamage));
    },
  );

  it("shows the shop's price, which can differ from the catalogue's", () => {
    expect(dudeInfoContent(DUDE_KINDS.intern, 7).price).toBe("7g each");
  });

  it("lists a kind's special abilities only when it has them", () => {
    const labels = (id: DudeKindId) =>
      dudeInfoContent(DUDE_KINDS[id], 1).stats.map((s) => s.label);
    expect(labels("intern")).toEqual(["Health", "Speed", "Goal damage"]);
    expect(labels("balloonist")).toContain("Flies");
    expect(labels("shield-bro")).toContain("Shield");
    expect(labels("hype-man")).toContain("Hype aura");
    expect(labels("mole")).toContain("Tunnels");
    expect(labels("streaker")).toContain("Draws fire");
    expect(labels("termite")).toContain("Breaks walls");
  });
});
