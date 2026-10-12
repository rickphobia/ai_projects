# 36: Heatwave

**What to build:** The second Disaster: in a Heatwave every second on the Generator adds more Exhaustion, shown as heat shimmer and a harsher light, with the same warning, countdown and cheerful "Nature cannot stop us!" as a Sandstorm (land and hazards spec: stories 72, 77–78, 83, 102; "Implementation Decisions": Disasters).

**Blocked by:** 35 (Sandstorm)

**Status:** done

**Touches:** rules, config/tuning, content/app-text, adapters/field, adapters/debug

**Effort:** low

- [x] If no Sandstorm was rolled, a Heatwave is rolled with its own chance per Shift
- [x] While it lasts, Exhaustion from running is multiplied by a factor between 1 and 2
- [x] Heat shimmer and a harsher light; with reduced motion, a still tint instead
- [x] Debug mode adds "Heatwave now"
- [x] GUT tests through Farm cover the roll and the Exhaustion factor
