# 29: Dudes with faces: the look and the first five kinds

**What to build:** Dudes become TABS-style: a round blob body in the attack colour with a dark outline and two dot eyes. They waddle as they walk, look panicked for a moment when hit, and flop over and fade when they die. Intern (small, with a tie), Termite (bug body, antennae), Ram Crew (a log carried by four heads), Balloonist (hanging under a balloon) and Shield Bro (a big shield in front) get their own silhouettes; the other kinds use the Intern body until ticket 30. The dark glow and the eraser's dimming of older Dudes keep working. See `docs/specs/art-pass.md`, stories 11–17, 19, 20.

**Blocked by:** 28 (Draw the Board in code)

**Status:** ready

**Touches:** renderer/art-kit, renderer/units

**Effort:** medium

- [ ] The five kinds are drawn by the art kit and are told apart by shape, not colour; the Kenney soldier tile and the disc under each Dude are gone
- [ ] Waddle comes from the Dude's index and the battle step, so a replay looks the same; flop-and-fade never changes the battle
- [ ] Every kind is readable on a phone at fit-to-window zoom (phone screenshot)
- [ ] Dudes glow in the dark, and older Dudes dim while the eraser is chosen (screenshots)
- [ ] The spec's "Look" section rule for Dudes is rewritten
- [ ] The debug swarm screen (500 Interns) still runs at 60 fps on the Beelink's browser; the fps is in the PR
- [ ] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
