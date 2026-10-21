# 33: The Settings menu as a card

**What to build:** The Settings menu becomes a card. Each trick has a drawn icon (a sun for Brightness, a turtle and a rabbit for Game speed, a speaker for Volume, a window for Window size) and a chunky slider whose track fills blue toward the side that helps the defense and orange-red toward the side that helps the attack, with the price as a coin chip on the handle. Undo becomes a separate red button with a skull icon. See `docs/specs/art-pass.md`, stories 38–41.

**Blocked by:** 31 (Chunky cartoon UI and the top bar)

**Status:** done

**Touches:** ui/settings

**Effort:** low

- [x] Each trick row has its icon, side-coloured slider and coin price chip
- [x] Undo is a separate red skull button, never next to Take back
- [x] The menu still works by touch with no hover
- [x] Existing settings tests still pass without being weakened
- [x] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
