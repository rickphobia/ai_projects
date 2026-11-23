# 49: Export with ink

**What to build:** "Export with ink" is the last row of the Send to menu. It makes a new PDF of the whole Document, under the Document's own name, with the PDF's own pages kept as they are (sharp, with selectable slide text) and my strokes drawn on them: pen, red ink and the see-through highlighter, as on screen. Inserted pages come out in their place as A4 pages with their strokes (their backgrounds and Pictures come in ticket 50). It runs behind a progress bar with Cancel, then opens the Share sheet; no copy is kept in the Study folder and the PDF itself never changes. This adds the **Export plan** seam in `core`, and decision record 0008 for how the `app` draws it. Spec: `docs/specs/export-with-ink.md`, stories 1, 3–10, 16 and 18 (Export with ink part).

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-export, app-export, app-share

**Effort:** medium

**Owner steps:** the on-tablet check in the PR, in the Preview app. If decision 0008 finds that the PDF's pages can only be kept by turning them into pictures, stop and ask the owner before building that.

- [x] Decision record 0008: the way to draw onto the PDF's own pages (a maintained PDF library, or Android 16's PDF editing APIs), with its licence and the APK size it adds
- [x] Export plan: no strokes, Pictures or Inserted pages gives Bare; strokes come out on the right pages, in the order written, with their tool, colour and width in PDF points; Inserted pages are A4 in their place; a damaged Ink file gives Ink unreadable; a waiting Conflict copy gives Pick a side first; a stroke added after the snapshot is not in the plan (tested)
- [x] Strokes are drawn as vector shapes with the on-screen brushes; the highlighter stays see-through
- [x] Bare shares the PDF as it is
- [x] Ink unreadable says "Ink can't be read, so it can't be exported" and points to Getting old ink back; Pick a side first asks for Keep mine or Keep the other first; nothing is shared
- [x] Follows the Log PDF export's pattern (off the main thread, progress, share through the file provider) rather than a second copy of it
- [x] Written off the main thread to a cache folder emptied before each Export, named like the Document, shared through the app's file provider; a progress bar (pages done of all) with Cancel; a cancel or failure deletes the partial file, shares nothing and says why
- [x] Logs each Export (page count, Inserted pages, stroke count, time, size in bytes, Share sheet or Send to), a cancel, a failure with its step, and a refusal; never strokes, file names or prompts
- [x] README describes Export with ink
- [x] On-tablet check written in the PR: export a tutorial with pen, red ink, highlighter and an Inserted page; open it in another reader, where the ink is there and the slide text can be selected; cancel a 100-page lecture's Export halfway
