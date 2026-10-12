# 15: Selection popup: Ask AI and Dictionary

**What to build:** Selecting text in a Briefing, Item or Chat answer shows a popup. Ask AI opens the Chat with the selection and where it came from. Dictionary shows a short definition that fits the surrounding text, including jargon, tickers and Malay words. Spec user stories 58, 59, 61.

**Blocked by:** 14 (Chat web search and compaction), 26 (Chat panel in the Inbox)

**Status:** ready

**Touches:** dictionary, chat, adapters/language_model, web/dictionary, pwa/selection, pwa/chat

**Effort:** low

- [ ] Selection popup on Briefings, Items and Chat answers, working with touch selection on Android
- [ ] Ask AI attaches the selection to the Chat as quoted context with its origin
- [ ] LanguageModel gains a define-word operation; the Dictionary model defaults to `claude-haiku-5-5`; it checks the spending status and records its calls
- [ ] Dictionary look-up API
- [ ] Adapter test against a saved definition response; API tests cover the look-up and the limit; Vitest tests cover the popup, Ask AI and Dictionary
