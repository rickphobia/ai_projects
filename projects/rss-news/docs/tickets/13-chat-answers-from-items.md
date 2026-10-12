# 13: Chat answers from Items

**What to build:** A Chat docked in the Inbox (side panel on desktop, bottom sheet on the phone). The owner asks "what happened in Malaysia" and gets an intro line naming the window and Item count, then the matching Items, each with a one-line summary and a Source button that opens the Item, plus a "Brief these" button. Follow-ups remember the conversation and earlier Chats are saved. Spec user stories 49–53, 55, 57.

**Blocked by:** 12 (Spending limit and page)

**Status:** ready

**Touches:** chat, adapters/language_model, adapters/sqlite/chat, web/chat, pwa/chat, pwa/inbox

**Effort:** medium

- [ ] LanguageModel gains a Chat-turn-with-tools operation; the Chat model defaults to `claude-opus-5-5`
- [ ] A `search_items` tool filters by Folder, time window (up to 90 days back), keyword and minimum Importance, defaulting to the last 24 hours
- [ ] Answers are structured as an intro line plus `{item_id, one-line summary}` entries; Item IDs that aren't real Items are dropped
- [ ] Send-message API streams the answer; Chats and their messages are saved and listed
- [ ] Chat checks the spending status and refuses with a clear error when stopped; its calls go in the ledger
- [ ] PWA Chat panel with Source buttons, "Brief these" and the list of earlier Chats
- [ ] Adapter test against a saved Chat turn with tool use; API tests cover the window default, a named window, Item ID checking and the limit; Vitest tests cover a Source button opening the Item and "Brief these"
- [ ] README and `.env.example` updated
