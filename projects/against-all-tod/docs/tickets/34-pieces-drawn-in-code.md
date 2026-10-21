# 34: Draw the Pieces in code

**What to build:** Every Piece is drawn by the art kit with its working part in the defense colour and its own silhouette: Sniper Nest (sandbags, a barrel that turns), Turnstile (a gate with turning arms), Lighthouse (white and red tower, sweeping light cone), Siren (pole, loudspeaker horn, pulsing rings), Tax Booth (booth with a barrier arm), Grinder (floor plate, spinning teeth), Bouncer (big guy, shades, crossed arms), Decoy Goal (a crooked cardboard Goal office) and The HR Department (grey desk, "HR" sign, stern face). Floor traps are flat, towers and walls stand with a shadow, and the placement cursor and refused tiles match. The last Kenney tiles and their README credit are removed. See `docs/specs/art-pass.md`, stories 21–23.

**Blocked by:** 30 (The other five Dudes and Mutation marks)

**Status:** ready

**Touches:** renderer/art-kit, renderer/pieces, assets/tiles, README

**Effort:** medium

- [ ] Every Piece in the catalog has its own drawing; a test fails if one has none
- [ ] Turning parts turn and the Lighthouse cone sweeps by sprite transforms, not redrawing each frame
- [ ] Pieces stay outlined and readable in the dark (screenshot)
- [ ] The Kenney tile folder and its README credit are gone; the Kenney sounds stay
- [ ] The spec's "Look" rules for Pieces and the art pack are rewritten
- [ ] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
