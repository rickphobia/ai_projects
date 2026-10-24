# 36: Inserted pages

**What to build:** A page menu on every page of any Document offers "Insert page after" with a background choice (blank, lined, grid or dotted). The **Inserted page** is A4 portrait, drawn by the app with lines at 8 mm and grid and dots at 5 mm in light grey with a plain top margin, and takes ink like any page. Removing an inserted page asks first if it has ink, is one undo step, and undo brings its ink and Pictures back. A PDF's own pages can't be removed. The PDF is never changed (stories 25, 26, 28). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-session, core-inkfile, app-viewer

**Effort:** medium

- [x] Ink file records an inserted page's background; older Ink files open unchanged (tested)
- [x] Document session: insert and remove as undo steps; removing one with ink and undoing brings the ink back; a PDF's own page can't be removed (tested)
- [x] Background geometry is one set of named constants in `core`
- [x] Page menu with Insert page after and Remove page, asking first when the page has ink
- [x] Page numbers and page jump count inserted pages
- [x] On-tablet check written in the PR: insert a lined and a grid page into a lecture, write on them, remove one and undo, reopen with both there and the PDF unchanged

**Owner steps:** the on-tablet check in the Preview app (in the PR body).
