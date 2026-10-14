# 41: Title screen, Settings and letters

**What to build:** The title screen and Settings use the App look's muted theme: the shared font, spacing, radii and button states in today's calm colours, with the content note unchanged. The Children's letters keep their paper and handwriting, with buttons big enough for a phone. The Letters button and the savings tin get their pencil icons (app polish spec: stories 20, 37–39; "Implementation Decisions": Title screen, Settings and letters).

**Blocked by:** 38 (Icon set and icon lookup)

**Status:** ready

**Touches:** adapters/title, adapters/settings, adapters/letters, adapters/savings-tin

**Effort:** low

- [ ] The title screen and Settings use the muted theme, and Settings looks the same opened from the title screen or from The App
- [ ] The content note's wording is unchanged
- [ ] Letters keep their paper, ink and handwriting font; their buttons are at least 88 base pixels in their short side
- [ ] The Letters button and the savings tin show their pencil icons; neither uses The App's colours or font
- [ ] GUT tests: the title screen and Settings roots use the muted theme, and the letters' button sizes; existing title, settings and letters tests pass, changed only where a node they find moved
- [ ] No diff under `src/rules`, `src/config`, `src/content` or `tests/rules`
- [ ] PR shows screenshots of the title screen, Settings, a letter and the tin
