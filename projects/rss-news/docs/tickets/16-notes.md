# 16: Notes

**What to build:** Note in the selection popup saves the selected text with an optional comment and a link back to the Briefing, Item or Chat it came from. A Notes page lists them newest first; the owner can edit a comment, delete a Note and export all Notes as Markdown. Spec user stories 60, 62–64, 81.

**Blocked by:** 15 (Selection popup: Ask AI and Dictionary)

**Status:** done

**Touches:** notes, adapters/sqlite/notes, web/notes, pwa/notes, pwa/selection, pwa/shell

**Effort:** low

- [x] Notes API: list, create, update, delete, export as Markdown
- [x] A Note's link back still works after its Item is deleted by cleanup, showing the saved text and saying the Item is gone
- [x] Note action in the selection popup, with an optional comment
- [x] PWA Notes screen
- [x] API tests cover each action and the export; Vitest tests cover saving from the popup
