# 23: App shortcuts

**What to build:** Long-pressing the app icon offers "Brief me (24h)", "Chat" and "Notes", each opening straight to that action. Spec user story 73.

**Blocked by:** 16 (Notes), 19 (Installable app), 26 (Chat panel in the Inbox)

**Status:** done

**Touches:** pwa/manifest

**Effort:** low

- [x] Manifest shortcuts for "Brief me (24h)", "Chat" and "Notes", with icons
- [x] Each shortcut's URL opens the right screen and, for "Brief me (24h)", starts the Briefing (or shows today's saved one)
- [x] A Vitest test covers each shortcut URL routing to its screen
