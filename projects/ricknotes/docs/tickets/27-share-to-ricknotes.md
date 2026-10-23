# 27: Share → RickNotes

**What to build:** RickNotes appears in Android's share menu for images and PDFs. A shared PDF opens a folder picker starting at the folder of the Document I last had open, then is copied there and opened. A shared image opens the last Document at the page I was on, with the Picture in the middle of the screen, ready to move; a "Different Document…" choice lets me pick another. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 24 (Drop a screenshot onto a page), 26 (Drop a PDF in)

**Status:** done

**Touches:** app-import, app-main

**Effort:** low

- [x] The app accepts shared images (PNG, JPEG, WebP) and PDFs
- [x] A shared PDF → folder picker starting at the last Document's folder → copied and opened
- [x] A shared image → last Document, last page, Picture centred on screen; "Different Document…" works
- [x] A share with no Document ever opened goes straight to choosing a Document
- [x] An unreadable share shows a clear message
- [x] On-tablet check written in the PR: share a screenshot and a downloaded PDF from another app

**Owner steps:** on the tablet, share a screenshot and a downloaded PDF to RickNotes from another app (steps in the PR).
