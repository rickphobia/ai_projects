# 24: Spawn zone and a charging Army

**What to build:** The Board grows to 22 × 14 and its left 3 columns become the Spawn zone, drawn with the attack-colour stripe; the defender can't build there, and the Maze keeps its 19 columns. When a battle starts the whole Army already stands on the Board and charges at once, instead of filing in one Dude at a time. Squads still exist for now: the attacker taps any zone tile to put a Squad there, and its Dudes stand spread over that tile. See `docs/specs/spawn-zone.md`.

**Blocked by:** 16 (Brightness and Game speed tricks)

**Status:** done

**Touches:** maze, battle, run, renderer/board, ui/report, debug

**Effort:** medium

- [x] The Board is 22 × 14, the Spawn zone is columns 0–2, the Goal stays on the right edge; routes start from any zone tile
- [x] Placing a Piece in the Spawn zone is refused with its own reason; placing a Squad anywhere outside it is refused
- [x] A Squad can go on any zone tile; its Dudes stand spread over that tile at step 0, and the whole Army charges at once (no waiting list, no spawn interval)
- [x] The Bouncer throws a Dude back to the spot it started the battle on
- [x] The Spawn zone stripe covers the 3 columns; the Round report's death map uses the Board's real width
- [x] A save from before this ticket gets the usual fresh start (save version bumped) if its shape changes
- [x] The 500-Intern swarm benchmark, now all starting at once, stays within budget
- [x] Tests: Board and zone bounds, Pieces refused in the zone, whole Army on the Board at step 0, Dudes reach the Goal from every zone column, Bouncer return spot, same-seed replay
- [x] Spec, README and glossary match
