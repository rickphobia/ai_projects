# 07: Books, Book pages and Recent

**What to build:** Opening Gloss shows a Books screen (books with Lookups or Notes, most recent first) and a Recent list across all books. A Book page shows that book's Notes and Lookups in reading order by chapter; past Lookups open to their whole chat; Notes can be edited and deleted, and Lookups deleted.

**Blocked by:** 06 Notes

**Status:** done

**Touches:** core-bookpages, app-books, app-storage

**Effort:** medium

- [x] Books screen, most recent first, including a "No book" entry for Lookups and Notes without Book context
- [x] Book page ordered by chapter, then position in the chapter
- [x] Recent: newest Lookups and Notes across books
- [x] A past Lookup opens to its whole chat
- [x] Edit and delete a Note; delete a Lookup, which also deletes its Notes after a confirmation
- [x] Core tests: ordering, Recent, "No book", deleting
