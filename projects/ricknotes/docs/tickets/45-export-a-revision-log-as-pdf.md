# 45: Export a Revision log as PDF

**What to build:** A course's Revision log screen gets **Export PDF**. It writes `<course> revision log.pdf` into the Course folder, replacing the last export, then opens the Share sheet. The PDF follows the screen's filter and newest-first order. Each Entry shows its back Snip (cropped to the box for Entries from Red marks), its Document, page, date, kind, category and "why", on A4 portrait pages, never split across two pages. This adds the Log PDF layout seam in `core`; Android's PDF writer draws it in `app`. Spec: `docs/specs/red-ink-and-log-pdf.md`. Stories 25–31.

**Blocked by:** 43 (Open zoomed to the Red mark)

**Status:** done

**Touches:** core-logpdf, app-logpdf, app-revisionlog

**Effort:** medium

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [x] Log PDF layout: Entries fill a page and the next one starts a new page; no Entry is split; a tall Snip is capped at half the printable height; an Entry with a box is cropped to it with the on-screen margin; filter and order are kept (tested)
- [x] An empty list is refused, and the screen says there is nothing to export (tested at the seam)
- [x] Page size, margins and text block height are named constants
- [x] Written with the safe write, off the main thread, with a progress indicator; a failure shows a clear message and leaves the old export whole
- [x] The exported PDF shows in the tree like any other Document
- [x] Logs PDF exported (Entry count, page count, size in bytes) or failed; never Snips or "why" text
- [x] README describes Export PDF
- [ ] On-tablet check written in the PR: export a course with Mistakes and Key points, open the PDF in another reader, share it
