# 03: Book context from Legado

**What to build:** Define in Legado now knows the book: it uses the book read most recently, finds the Selection in the current chapter, and sends the book, author, chapter and the text before the Selection, never anything past it. When it can't, it still answers and says "No book context" and why. See decision 0001.

**Blocked by:** 02 Define, without Book context

**Status:** ready

**Touches:** core-context, app-legado, core-gloss, app-card, app-onboarding

**Effort:** medium

- [ ] Legado adapter for `127.0.0.1:1122` (`/getBookshelf`, `/getBookContent`), port in the settings module, short timeouts; every failure (refused, timeout, `isSuccess: false`, bad JSON) becomes a "no Book context" reason
- [ ] Adapter tests against responses recorded on the owner's phone (bookshelf with signatures and tokens removed, an online chapter, a local EPUB chapter, the "Permission Denial" failure); the phone is reachable from the Beelink at `100.87.90.10:1122` over Tailscale to record them
- [ ] Book context rule in core: most recent book by `durChapterTime`; Selection matched in the chapter ignoring whitespace, line breaks, quote and dash styles; nearest occurrence to `durChapterPos` when repeated; up to about 3,000 words before the Selection plus the rest of its paragraph
- [ ] The prompt carries the book, author, chapter and context, and the rule that nothing past this point may be used or revealed
- [ ] Card shows the book and chapter used, or "No book context" with a short reason (Web service off, not found in the chapter)
- [ ] First-run screen tells the owner to switch on Legado's Web service and shows whether Gloss can reach it
- [ ] README "Reading on public Wi-Fi": the Web service exposes the bookshelf and book sources to the Wi-Fi; switch it off or use mobile data on Wi-Fi you don't control; set up Legado's WebDav backup; re-open the book if a local EPUB gives "Permission Denial"
- [ ] Core tests: found, found twice, not found, Legado off and slow, the word cap, nothing past the Selection's paragraph in the prompt, the spoiler rule present
- [ ] Checked by hand: Define in *Crime and Punishment* shows its chapter; Define in Chrome shows "No book context"
