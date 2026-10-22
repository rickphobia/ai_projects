# 18: Course folders

**What to build:** Folders three levels inside the Study folder (`Y1/Sem1/EE2001`) are **Course folders** without any setup. Long-pressing a folder in the tree lets me mark it as a Course folder or unmark it. Any Document can find its nearest Course folder, which later tickets use to choose the **Revision log**. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 17 (Home screen tree)

**Status:** done

**Touches:** core-studyfolder, core-settings, app-home, app-settings

**Effort:** low

- [x] Course folder resolution is tested: depth 3, a marked folder, an unmarked depth-3 folder, a Document outside any course
- [x] Marks and unmarks are two validated lists in app settings (tested in the settings loader)
- [x] Long-press a folder in the tree → Mark as course / Unmark; Course folders are shown distinctly in the tree
- [x] Unmarking never deletes anything
- [x] On-tablet check written in the PR: mark a non-standard folder, unmark a depth-3 folder, see the tree update
