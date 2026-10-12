# 13: Chat answers from Items

**What to build:** The Chat's backend. The owner asks "what happened in Malaysia" and gets an intro line naming the window and Item count, then the matching Items, each with a one-line summary. Follow-ups remember the conversation, and earlier Chats are saved. The panel in the Inbox that shows it (Source buttons, "Brief these", the list of earlier Chats) is ticket 26, split off because the whole was too big for one PR. Spec user stories 50, 52, 53, 55, 57.

**Blocked by:** 12 (Spending limit and page), 24 (Look and feel)

**Status:** done

**Touches:** chat, adapters/language_model, adapters/sqlite/chat, web/chat

**Effort:** medium

- [x] LanguageModel gains a Chat-turn-with-tools operation; the Chat model defaults to `claude-opus-5-5`
- [x] A `search_items` tool filters by Folder, time window (up to 90 days back), keyword and minimum Importance, defaulting to the last 24 hours
- [x] Answers are structured as an intro line plus `{item_id, one-line summary}` entries; Item IDs that aren't real Items are dropped
- [x] Send-message API streams the answer; Chats and their messages are saved and listed
- [x] Chat checks the spending status and refuses with a clear error when stopped; its calls go in the ledger
- [x] Adapter test against a saved Chat turn with tool use; API tests cover the window default, a named window, Item ID checking and the limit
- [x] README and `.env.example` updated
