# 26: The Farm's land comes from the rules

**What to build:** The rules, not the field, decide how big the Farm is. Land starts at 4 × 3 from the tuning table, and the rules give each Plot a cell that never changes. The field builds its Plots, fence and track from the land view, and the track follows the Farm's edges instead of being centred, so later land can be added on the right and at the back without moving the gate or the Generator. The game looks and plays exactly as before (land and hazards spec: stories 13, 17; "Implementation Decisions": Land, Adapters: Field).

**Blocked by:** 25 (Split the Shift end out of Farm)

**Status:** done

**Touches:** rules, config/tuning, adapters/field, entrypoint

**Effort:** medium

- [x] Farm's starting land comes from the tuning table (first columns and rows, and the largest), with validation that the largest Farm is at least the first
- [x] A land view gives the Farm's columns and rows and each Plot's cell; Plots keep their numbers, the first twelve in today's cells
- [x] The field builds Plots, fence and track from the land view instead of its own columns and rows
- [x] The track follows the Farm's edges, so a wider or deeper Farm grows to the right and the back with the gate where it is
- [x] Plot grid and track path tests cover Farms of other sizes, with the first twelve cells and the gate unchanged
- [x] The web build looks and plays as before
