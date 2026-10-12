# 16: OpenAI-compatible providers

**What to build:** Settings offers a second provider type, OpenAI-compatible, with a base URL, model name and key, so DeepSeek, GLM, OpenAI, Gemini, OpenRouter or a local Ollama can sort instead of Anthropic. See decision 0001.

**Blocked by:** 15 (AI sorting with Anthropic)

**Status:** ready

**Touches:** app/ai, app/settings

**Effort:** low

- [ ] OpenAI-compatible adapter for chat completions with the same timeout, retries, JSON validation and logging as the Anthropic one; tested against saved example responses
- [ ] Settings: provider choice, base URL validated as https (or http for a local address), model name, key
- [ ] README lists example base URLs and model names for the providers named above, checked against their current docs
- [ ] On-phone check: "Test connection" with one OpenAI-compatible provider
