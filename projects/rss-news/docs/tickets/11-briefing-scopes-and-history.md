# 11: Briefing scopes and history

**What to build:** The owner can brief one Folder instead of all Sources, choose a 7 day or 30 day window, tick Items in the Inbox and press "Brief these", and reread earlier Briefings from a list. Spec user stories 33, 40, 41, 44, 45.

**Blocked by:** 09 (Inbox search and old-Item cleanup), 10 (Brief me)

**Status:** ready

**Touches:** briefings, web/briefings, pwa/briefings, pwa/home, pwa/inbox, pwa/shell

**Effort:** low

- [ ] Briefing requests accept all Sources or one Folder × 24h, 7d or 30d, or a set of picked Items
- [ ] 7 day and 30 day Briefings use only Items at or above the configured Importance cut-off (3 by default)
- [ ] Home screen controls for scope and window, with the estimate updating as they change
- [ ] Inbox Items can be ticked and sent to "Brief these"
- [ ] Briefings list screen, newest first, opening a saved Briefing
- [ ] API tests cover each scope, the cut-off and picked Items; Vitest tests cover the controls and "Brief these"
