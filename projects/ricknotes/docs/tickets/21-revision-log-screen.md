# 21: Revision log screen

**What to build:** Each Course folder in the home tree has a Revision log row. It opens a list of Entries, newest first, filterable by Mistakes and Key points. An Entry's screen shows its Snip with and without ink, its labels, category and why (editable), and "Open in Document", which opens the Document at that page or says "Document not found". An Entry can be deleted from here after confirming. A Conflict copy of a Revision log shows a warning. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 20 (Add mistake and Add key point)

**Status:** done

**Touches:** core-revisionlog, app-revisionlog, app-home

**Effort:** low

- [x] Revision log row inside each Course folder in the tree; the list filters by Mistakes and Key points
- [x] Entry screen shows front and back, labels, category and why (editable)
- [x] Open in Document opens at the Entry's page; a missing Document shows "Document not found" and the Entry still works
- [x] Delete asks for confirmation and is tested in `core`; erasing ink never deletes Entries
- [x] A Conflict copy of `revision_log.json` shows a warning, and nothing is merged
- [x] On-tablet check written in the PR: browse a course's log, filter, open in Document, delete one
