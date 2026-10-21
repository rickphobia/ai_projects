# 30: The other five Dudes and Mutation marks

**What to build:** Hype Man (a megaphone), Sapper (a bomb on his back), Mole (a dirt mound with a head), Streaker (bare, with motion lines) and The Landlord (big, with a top hat and a cane) get their own silhouettes. Mutations show as a mark, not a new colour: Giant bigger, Split halves smaller, Ghost Mode see-through, Gold Teeth a gold grin, Explosive Shields a fuse, Conga Line hands on shoulders. See `docs/specs/art-pass.md`, stories 15 and 18.

**Blocked by:** 29 (Dudes with faces)

**Status:** ready

**Touches:** renderer/art-kit, renderer/units

**Effort:** low

- [ ] Every Dude kind in the catalog has its own drawing; a test fails if a kind has none
- [ ] Each Mutation's mark shows (a screenshot with every Mutation)
- [ ] The Landlord is still the biggest thing on the Board
- [ ] The debug swarm screen (500 Interns) still runs at 60 fps on the Beelink's browser; the fps is in the PR
- [ ] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
