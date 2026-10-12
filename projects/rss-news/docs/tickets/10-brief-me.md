# 10: Brief me (all Sources, 24h)

**What to build:** The home screen shows the latest Briefing and a "Brief me" button with its estimated cost. Pressing it writes a Briefing of all Sources over the last 24 hours, grouped by Folder, with each point linking to its Items, and shows progress while it's written. Pressing it again the same day shows the saved Briefing with a Regenerate button. Spec user stories 38, 39, 42, 43, 46–48.

**Blocked by:** 08 (Item view and Reader view)

**Status:** ready

**Touches:** briefings, adapters/language_model, adapters/sqlite/briefings, spending, web/briefings, pwa/home, pwa/shell

**Effort:** medium

- [ ] LanguageModel gains a write-Briefing-section operation; the Briefing model defaults to `claude-opus-5-5` at low effort
- [ ] One call per Folder section, each under the configured token budget (40K by default), given one-line summaries plus full text of the top Items through ArticleExtractor, cut to fit
- [ ] Points refer to Item IDs and the PWA turns them into links to the Item view
- [ ] Estimate API works out the cost from the selected Items and configured prices without calling the model
- [ ] Create API streams progress as server-sent events
- [ ] The same scope on the same day returns the saved Briefing unless Regenerate is asked for
- [ ] A failed section fails the whole Briefing: nothing is saved, and the cost already spent is still in the ledger
- [ ] PWA home screen with the latest Briefing, the button with its estimate, progress and Regenerate
- [ ] Adapter test against a saved Briefing-section response; API tests cover selection, estimate, reuse, Regenerate and failure; Vitest tests cover the cost display and Regenerate
- [ ] README and `.env.example` updated
