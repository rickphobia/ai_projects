# 40: Draft Crate as picture cards

**What to build:** The **Draft Crate** becomes a centred panel of three big cards, like the owner's reference (a "relic stash" picker from another game: title ribbon across the top, three framed cards, each with a name, a large picture, a one-line description and a **Choose** button underneath, reroll in the corner). Each card shows: a picture (the Dude kind's portrait with a large "×10" badge for free Dudes, the Mutation's mark for a Mutation, the Piece's drawing for a Piece), its name, its one-line description from the catalogue, and Choose. Reroll with its gold price sits in the panel's corner. The same cards are used on both sides, for attack crates (Dudes and Mutations) and defense crates (Pieces). Requested by the owner on 2026-10-22; this ticket is the whole scope.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** ui/crate

**Effort:** low

- [ ] The crate shows three picture cards with name, picture, description and Choose, in the game's existing chunky card style
- [ ] Free Dudes show the portrait with a "×N" badge; Mutations and Pieces show their own art; descriptions come from the catalogues (tested: a card's text comes from the catalogue entry)
- [ ] Reroll and its price sit in the panel's corner and still work; taking one item still closes the crate as before
- [ ] The panel no longer covers the Spawn zone or Maze while open in a way that hides what you're choosing for; it fits a 390×844 phone viewport without scrolling
- [ ] Screenshots in the PR of an attack crate and a defense crate, at 1910×873 and on a phone
- [ ] Lint, type checks and tests pass
