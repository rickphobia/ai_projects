# 14: Chat web search and compaction

**What to build:** The Chat answers from the owner's Items first, and searches the web only when asked or when no Items match, saying when it did. Long Chats are compacted automatically so they keep working and stay affordable. Spec user stories 54, 56.

**Blocked by:** 13 (Chat answers from Items)

**Status:** done

**Touches:** chat, adapters/language_model

**Effort:** low

- [x] Web search is offered only when the owner asks for it or `search_items` found nothing, capped at 5 searches per question
- [x] Answers that used web search are flagged, and searches are counted in the ledger at the configured price
- [x] Server-side compaction is turned on past the configured threshold (70K tokens by default)
- [x] Adapter test against a saved response with web search results and one with a refusal; API tests cover when web search is and isn't offered
- [x] README and `.env.example` updated
