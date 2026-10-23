# 02: Define, without Book context

**What to build:** The owner pastes their Anthropic key once, then Define on any Selection shows its meaning in one or two plain lines in the card, from the Selection alone. Failures show in the card with a way forward, and every Lookup is saved.

**Blocked by:** 01 Walking skeleton

**Status:** ready

**Touches:** core-gloss, app-ai, app-card, app-settings, app-storage

**Effort:** medium

- [ ] The Gloss core's entry point with ports for the AI, storage, clock and settings; Define(Selection) returns what the card shows and saves the Lookup
- [ ] First-run screen asks for the key and checks it with a small test call; the key is encrypted with an Android Keystore key and excluded from backup
- [ ] Anthropic Messages client: Define on Claude Haiku 5.5 (model name in the settings module), timeouts, one retry with backoff on network errors
- [ ] Define prompt: only the meaning in this sentence, one or two short plain lines; Define on a whole sentence gives the sentence's meaning the same way
- [ ] Card shows the Selection, a loading state, then the answer; no internet, AI errors and a rejected key show a message with Retry, and a rejected key points to Change key
- [ ] Lookups (Selection, answer, time) stored in SQLite (SQLDelight), excluded from backup
- [ ] Rolling log with "Share log" in Settings: model, tokens, latency, errors, never the Selection or answer
- [ ] Core tests with a fake AI cover the answer, each failure and the saved Lookup
- [ ] Checked by hand on the phone in Legado and Chrome
