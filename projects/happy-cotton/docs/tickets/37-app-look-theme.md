# 37: The App look: theme, font and tap feedback

**What to build:** One shared App look that The App's always-visible parts use: the top bar (Quota bar, Shift time, Exhaustion, crop counter), the balance badge, the speech bubble, the Store and Settings buttons and the supplies bar. It sets one rounded OFL font, bright colour tokens, rounded glossy panels and buttons in every state, and a squish when an App button is pressed (app polish spec: stories 1–11, 40, 43; "Implementation Decisions": One App look, Font, Phone layout). Every other App overlay part switches from its own rounded-box helper and colours to the App look's styles, so later tickets only redesign layouts.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** adapters/app-look, adapters/app-overlay, assets/font

**Effort:** medium

- [ ] An App look module builds a bright and a muted `Theme` in code from one set of colour tokens, a font, font sizes, an 8-pixel spacing scale, corner radii, and panel and button styles (normal, hover, pressed, disabled, focus)
- [ ] One rounded OFL font (Nunito, Baloo 2 or similar), pinned under `assets/` with its licence file; `assets/CREDITS.md` has its row and its rule now reads "CC0, or SIL OFL 1.1 for fonts"; the web export grows by no more than the font file
- [ ] Panels and buttons read as glossy: a light top highlight and a soft shadow
- [ ] Every App overlay part's root uses the App look's theme; no App overlay file builds its own rounded style box or defines its own colours any more (meaning-bearing colours such as Debt red are named tokens)
- [ ] The text-size setting scales the App look's font sizes in one place, and The App rescales as it does today
- [ ] App buttons squish on press and spring back; with reduced motion they don't; the press still reaches the rules at once
- [ ] The App still dims while the Generator stands still
- [ ] Every App button is at least 88 base pixels in its short side, and the top bar, bubble and supplies bar fit a 1280×720 screen without overlapping
- [ ] GUT tests: both themes have every token set; text size scales fonts; an overlay root uses the theme; a pressed button tweens only without reduced motion; button sizes
- [ ] No diff under `src/rules`, `src/config`, `src/content` or `tests/rules`; existing adapter tests pass, changed only where a node they find moved
- [ ] PR shows screenshots on a phone held sideways and on a desktop
