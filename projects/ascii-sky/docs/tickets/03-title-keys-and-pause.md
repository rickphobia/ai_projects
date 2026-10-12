# 03: Title screen, keys and pause

**What to build:** the game opens on an ASCII-art title screen listing every key. Any key starts it and drops the player into the Cockpit view on the Runway. `P` or `Esc` pauses and resumes with a clear PAUSED message, and switching tabs pauses too. On a device without a keyboard the game says it needs one.

**Blocked by:** 02 (The World seen from the Runway)

**Status:** done

**Touches:** game phases, screen, adapters/keyboard, entrypoint

**Effort:** low

- [x] The Game core has phases (title, flying, paused) and an Advance entry point taking the game state, the controls held down and the elapsed time
- [x] Controls are a plain set of actions; the keyboard adapter maps keys to them (arrows, `A`/`D`, `W`/`S`, `F`, `B`, `P`/`Esc`, `R`, any key to start)
- [x] Draw shows the title screen with the key list in the title phase and a PAUSED message in the paused phase
- [x] Hiding the tab pauses the game
- [x] A device without a keyboard sees a message that the game needs one
- [x] Unit tests through Advance and Draw: any key leaves the title; pause toggles; the title and PAUSED text appear in their phases
