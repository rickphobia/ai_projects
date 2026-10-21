# 35: Portraits in the unit bar and Piece shop

**What to build:** Each Dude kind in the unit bar shows its drawing above its price, and each Piece in the Piece shop shows its drawing, taken from the art kit's textures so the shop and the Board match. See `docs/specs/art-pass.md`, stories 35 and 36.

**Blocked by:** 31 (Chunky cartoon UI and the top bar), 34 (Draw the Pieces in code)

**Status:** ready

**Touches:** ui/shop, renderer/art-kit

**Effort:** low

- [ ] Every kind and Piece on sale shows its portrait above its price
- [ ] Portraits come from the art kit at start-up, not separate image files
- [ ] The gift count still shows on its kind
- [ ] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
