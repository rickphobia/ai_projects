# 06: Notes

**What to build:** Selecting text and tapping **Note** opens a card with the Selection and a text box, so the owner can save their own thoughts, kept with the Book context (or under "No book"). Define and Explain cards get a Note button that attaches a Note to that Lookup. Notes never go to the AI.

**Blocked by:** 05 Explain with follow-ups

**Status:** ready

**Touches:** core-notes, core-gloss, app-card, app-storage

**Effort:** low

- [ ] Note entry in the selection menu; the card shows the Selection, a text box and Save
- [ ] A Note is saved with its book and chapter when there is Book context, under "No book" otherwise
- [ ] Note button on Define and Explain cards attaches a Note to the Lookup
- [ ] An unsaved Note survives the card closing by accident until saved or discarded
- [ ] No AI call and no cost for a Note
- [ ] Core tests: Note alone, Note on a Lookup, "No book", nothing sent to the AI
