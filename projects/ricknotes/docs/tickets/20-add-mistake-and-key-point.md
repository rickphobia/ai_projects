# 20: Add mistake and Add key point

**What to build:** The floating Lasso menu gains **Add mistake** and **Add key point**. One tap adds an **Entry** to the Revision log of the Document's Course folder: two **Snips** of the rectangle around the loop (front without ink, back with ink, both including the page), labelled with Document, page and date. An "Added to EE2001 · Edit" note lets me set a category (Mistakes only: concept, algebra, careless, misread, didn't understand) and a "why" line. If the Document isn't in a Course folder, the actions explain why and point to marking one. This adds the Revision log seam in `core` (decision 0007). Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 16 (Floating Lasso menu), 18 (Course folders), 19 (Prefactor: shared safe saving)

**Status:** ready

**Touches:** core-revisionlog, app-revisionlog, app-snip, app-ink

**Effort:** medium

- [ ] Revision log seam: add an Entry, edit category and why, reopen with everything there (tested with a real temporary folder and a fake clock)
- [ ] Saves use the shared safe saving from 19; a failed save leaves the old file whole; Versions are taken (tested)
- [ ] A damaged `revision_log.json` opens read-only and is never overwritten (tested)
- [ ] Add mistake and Add key point work with an empty loop (a printed question only)
- [ ] Front and back Snips are rendered off the main thread at a fixed resolution with a capped long edge; the note appears once both are written
- [ ] Adding an Entry never changes the Document's ink or the PDF
- [ ] Logs Entry added (course folder name, Entry ID, kind); never Snips, strokes or the why text
- [ ] On-tablet check written in the PR: lasso a question with red working, Add mistake, edit category and why, find both PNGs and the JSON in the Course folder
