# 33: Bollworms

**What to build:** Now and then Bollworms appear on a growing Plot while the game is open. Tapping the Plot picks them off, which takes time and adds Exhaustion. Left too long they eat the crop, the Plot empties, and The App logs it as Negligence, punished like a Withered crop. They don't come or eat during a Study Session (land and hazards spec: stories 84–87, 89–93, 101–102; "Implementation Decisions": Bollworms).

**Blocked by:** 32 (Supplies and Fertiliser)

**Status:** done

**Touches:** rules, config/tuning, content/app-text, adapters/field, adapters/save, adapters/debug

**Effort:** medium

- [x] Every set number of seconds of online play outside Study Sessions, each growing Plot without Bollworms gets them by chance (tuning)
- [x] Tapping a Plot with Bollworms picks them off first; it takes a set time (the Worker is busy) and adds a set Exhaustion
- [x] A ripe crop with Bollworms can't be picked until they're picked off
- [x] Left for the set time, counted online outside Study Sessions, they eat the crop: the Plot empties and Negligence is logged as for a Withered Plot
- [x] Nothing comes or eats offline
- [x] Plots with Bollworms are easy to spot in the field
- [x] All the numbers come from the tuning table, with validation that eating takes longer than picking off
- [x] Bollworms on each Plot are saved
- [x] Debug mode adds "Bollworms now"
- [x] Bollworms arriving, picked off and eating a crop (Plot) are logged
- [x] GUT tests through Farm cover arriving, picking off, eating, Negligence, offline and Study Sessions
