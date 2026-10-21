# 37: Title screen, turn banners and transitions

**What to build:** A title screen with a drawn logo, the best Score and a big Play button (continues the saved Run; a smaller New Run starts one) shows before the Run, skipped when the URL carries a seed or asks for the swarm screen. Ribbon banners slide in at each turn change ("DEFENSE TURN!" in blue, "ATTACK TURN!" in orange-red) and when a battle is won or lost, and screens change with a short soft transition. Banners and transitions last under a second and skip on a tap. See `docs/specs/art-pass.md`, stories 47–53.

**Blocked by:** 32 (Cards for the crate, report, end screen and Pause)

**Status:** done

**Touches:** ui/title-screen, ui/banner, main, run-screen

**Effort:** medium

- [x] The title screen shows on a plain visit and is skipped with a seed or the swarm option in the URL (tested)
- [x] Play continues a saved Run, New Run starts a fresh one (tested)
- [x] Turn and win/lose banners show and skip on a tap (tested)
- [x] Transitions and banners never last a second or more
- [x] README describes the title screen
- [x] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
