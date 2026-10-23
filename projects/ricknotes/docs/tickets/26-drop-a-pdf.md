# 26: Drop a PDF in

**What to build:** Dropping a PDF onto a folder in the home tree copies it into that folder; dropping it onto an open page copies it into that Document's folder. Either way it then opens. If the name is taken it becomes `tuto3 (2).pdf`, `tuto3 (3).pdf` …, never overwriting. The source file is never moved or changed. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 17 (Home screen tree), 24 (Drop a screenshot onto a page)

**Status:** done

**Touches:** core-studyfolder, app-home, app-import

**Effort:** low

- [x] Study folder seam copies a file in with the safe write and picks `(2)`, `(3)` names (tested with one and two clashes; source unchanged)
- [x] Folder rows in the tree accept a dropped PDF; the page view accepts a PDF into the open Document's folder
- [x] The copied PDF opens afterwards
- [x] Logs file type, size and whether the name clashed
- [x] On-tablet check written in the PR: drop the same PDF twice onto a folder from the Files app in split screen
