# 19: Undo

**What to build:** The player can Undo a Settings trick: the slider snaps back to the middle and the side being played pays by destroying its own Pieces or Dudes of its choice, worth at least the Undo price.

**Blocked by:** 18 (Window size trick)

**Status:** done

**Touches:** tricks, run, ui/settings

**Effort:** low

- [x] Undo price per slider comes from the catalog and grows with how far the slider is from the middle
- [x] Player picks Pieces (Defense turn) or Dudes (Attack turn, with the eraser, earlier Rounds included, nothing refunded) to destroy; Undo is refused until the picked value covers the price
- [x] A free Undo item (from boss crates later) skips the payment
- [x] Undoing Window size resizes the Board the way a drag does (`resizeMaze` and `squeezeArmy`, through the Run's Window size drag), not just a slider reset: Pieces left on a closed lane would otherwise make the Maze unbuildable
- [x] Tests: price, refusal when short, chosen items destroyed, free Undo
