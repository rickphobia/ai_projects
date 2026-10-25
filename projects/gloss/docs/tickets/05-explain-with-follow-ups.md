# 05: Explain with follow-ups

**What to build:** Selecting a sentence or passage and tapping **Explain** gives a short, simple (ELI5) paragraph about what it means, with any idiom, irony or reference, and the owner can ask follow-up questions in the card with the same Book context and Spoiler line. A Define card gets **Explain more**, which turns its Selection into an Explain chat. Milestone 2 is complete.

**Blocked by:** 04 Spending limit

**Status:** done

**Touches:** core-gloss, app-ai, app-card

**Effort:** medium

- [x] Explain entry in the selection menu; Explain and follow-ups on Claude Sonnet 5.5 (model in the settings module)
- [x] Explain prompt: a short ELI5 paragraph; follow-ups answered briefly; Explain on one word explains it in context the same way
- [x] Follow-up text box under the answer; the card grows to full height and scrolls
- [x] Follow-ups keep the Book context and Spoiler line; the Book context is marked for prompt caching
- [x] The whole chat is saved with the Lookup; every turn goes through the Spending limit
- [x] Explain more on a Define card starts an Explain chat on the same Selection
- [x] Core tests: Explain, follow-ups keep context and the spoiler rule, Explain more, limit reached mid-chat
- [ ] Checked by hand in Legado (owner step below)

**Also changed:** the settings module (`PhoneSettings`: Sonnet 5.5's model, price, max tokens and effort), core-spending (`ModelPrice` prices cache writes and reads, so cached turns count honestly) and core storage (`lookup.kind`, table `follow_up`, migration `2.sqm`), all needed by the criteria above.

**Owner steps:** the hand check on the phone with the Preview (no phone is attached to the Beelink): Explain a sentence and a single word in *Crime and Punishment* in Legado; ask two follow-ups and check the keyboard doesn't cover the box, the card grows to full height and scrolls to the newest answer; tap **Explain more** on a Define card; Explain in Chrome ("No book context: not found in the chapter"); then Share log and check the second follow-up's `messages model=claude-sonnet-5-5` line shows `cache_read_tokens` above 0. Upgrading over 0.4.0 exercises the `2.sqm` migration.
