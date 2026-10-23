# 35: Orphaned ink

**What to build:** An Ink file whose PDF is missing, usually because the PDF was renamed on Drive, shows greyed in the tree as **Orphaned ink**. Its "Link to PDF…" action lists the PDFs in the same folder that have no ink yet, and linking one renames the Ink file, `.assets` and Versions to match it. The page-count mismatch warning then applies as usual (story 21). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 34 (Rename, move and new folder)

**Status:** ready

**Touches:** core-studyfolder, app-home

**Effort:** low

- [ ] Study folder: Orphaned ink is found in a listing; the candidates are the same folder's PDFs without ink; linking renames every companion and refuses on a clash (tested)
- [ ] The tree shows Orphaned ink greyed with "Link to PDF…"
- [ ] On-tablet check written in the PR: rename an inked PDF in Files, see it greyed, link it back, reopen with the ink there
