# 05: Explain with follow-ups

**What to build:** Selecting a sentence or passage and tapping **Explain** gives a short, simple (ELI5) paragraph about what it means, with any idiom, irony or reference, and the owner can ask follow-up questions in the card with the same Book context and Spoiler line. A Define card gets **Explain more**, which turns its Selection into an Explain chat. Milestone 2 is complete.

**Blocked by:** 04 Spending limit

**Status:** ready

**Touches:** core-gloss, app-ai, app-card

**Effort:** medium

- [ ] Explain entry in the selection menu; Explain and follow-ups on Claude Sonnet 5.5 (model in the settings module)
- [ ] Explain prompt: a short ELI5 paragraph; follow-ups answered briefly; Explain on one word explains it in context the same way
- [ ] Follow-up text box under the answer; the card grows to full height and scrolls
- [ ] Follow-ups keep the Book context and Spoiler line; the Book context is marked for prompt caching
- [ ] The whole chat is saved with the Lookup; every turn goes through the Spending limit
- [ ] Explain more on a Define card starts an Explain chat on the same Selection
- [ ] Core tests: Explain, follow-ups keep context and the spoiler rule, Explain more, limit reached mid-chat
- [ ] Checked by hand in Legado
