# 31: Chunky cartoon UI and the top bar

**What to build:** The UI's shared look: thick rounded buttons with a bottom shadow that press in, chips and cards as shared page styles, and a bundled rounded display font (Fredoka, OFL) for headings and buttons. The top bar becomes icon chips (❤ Lives, 🛡 Defense gold, ⚔ Attack gold, ★ Score, Round) with the turn in the side's colour, and Fight and Take back get the new button look. Every button is at least 44 px tall on touch. See `docs/specs/art-pass.md`, stories 32–34, 43–45.

**Blocked by:** 27 (Take back this Round's moves)

**Status:** done

**Touches:** ui/style, ui/hud, assets/fonts

**Effort:** medium

- [x] Shared button, chip and card styles exist in the page stylesheet, using CSS variables only
- [x] The font is bundled with its licence, credited in the README, and works offline (no outside request)
- [x] The top bar shows icon chips; the active side's colour marks the turn and the active choice
- [x] Fight and Take back use the new button look; all HUD buttons are at least 44 px tall on touch
- [x] The spec's "Look" UI rule is rewritten
- [x] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
