# 26: Chat panel in the Inbox

**What to build:** The PWA side of the Chat from ticket 13. A Chat docked in the Inbox (side panel on desktop, bottom sheet on the phone) where the owner types a question, sees the searches as they run, and gets the answer: the intro line, then each Item with its one-line summary and a Source button that opens the Item, plus a "Brief these" button that offers a Briefing of exactly those Items. The panel lists earlier Chats and reopens one. Spec user stories 49–51, 57.

**Blocked by:** 13 (Chat answers from Items)

**Status:** ready

**Touches:** pwa/chat, pwa/inbox, pwa/api

**Effort:** medium

- [ ] `ApiClient` gains `chats`, `createChat`, `chat` and `askChat` (reading the `searched`, `message` and `failed` events from `POST /api/chats/{id}/messages`); a 429 shows the spending limit's message
- [ ] PWA Chat panel in the Inbox: a side panel from 900px, a bottom sheet below, styled in `styles.css`
- [ ] Each answer shows its intro, its Items with Source buttons opening the Item view, and "Brief these" opening the home screen with those Items picked
- [ ] The list of earlier Chats, newest used first; choosing one shows its messages and continues it
- [ ] Vitest tests cover a Source button opening the Item, "Brief these", a failed answer and the list of Chats
- [ ] README updated
