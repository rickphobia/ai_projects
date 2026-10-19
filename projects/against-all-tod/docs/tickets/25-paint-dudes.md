# 25: Paint Dudes by dragging, paying per Dude

**What to build:** Squads leave the game, as in Totally Accurate Battle Simulator. On an Attack turn a unit bar lists every Dude kind with its price per Dude; the attacker taps one as the brush and drags inside the Spawn zone to paint single Dudes along the stroke, paying for each as it appears. Dudes keep room around them by size, so a full zone holds about 500 Interns. The Army is every Dude placed so far, each back where it was painted every Round. Crate gifts, Giant, Conga Line and Round 1's Army are re-cut for single Dudes. See `docs/specs/spawn-zone.md` and decision 0002.

**Blocked by:** 24 (Spawn zone and a charging Army)

**Status:** done

**Touches:** catalog, battle, run, adapters/input, ui/shop, renderer/units, adapters/storage

**Effort:** medium

- [x] The catalog replaces Squad size and price with a whole-number price per Dude, a crate gift size and Giant's N per kind, plus the paint spacing; a full zone of Interns is about 500
- [x] The Army is a list of placed Dudes (kind, spot, Stroke, Round painted) in paint order; Squads are removed from the code
- [x] A `paint-dude` Run action puts one Dude at a spot, refused outside the zone, too close to another Dude, outside an Attack turn's building phase, for a kind not on sale, or without enough gold
- [x] A drag that starts in the zone with a brush chosen paints and never pans; a drag starting elsewhere pans; a second finger turns a paint into a pinch; holding still adds nothing
- [x] The unit bar shows each kind's name and price per Dude and the gift count on its kind; refusals show in the HUD message line
- [x] An attack crate offers a gift of free Dudes of one kind (its gift size); painting that kind uses the gift first, then gold; an unused gift is lost at the end of the Round
- [x] Giant makes every Nth Dude of each kind giant, in paint order; Conga Line lines up and shares damage per Stroke
- [x] Round 1's game-made Army is a seeded layout of Interns in the zone
- [x] Painted Dudes are drawn where they stand while building; the Squad view goes
- [x] The save version goes up; a painted Army round-trips; an old save starts fresh with the usual message
- [x] Tests: painting until gold runs out, every refusal, gift used first, Giant every Nth, Conga per Stroke, gestures, save round-trip, catalog tuning check, same-seed replay
- [x] Spec, README and glossary match
