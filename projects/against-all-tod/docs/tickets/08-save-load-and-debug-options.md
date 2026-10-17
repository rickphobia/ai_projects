# 08: Save, load and debug options

**What to build:** The current Run, best Score and later progress survive a refresh or a closed tab. A reload during a battle restarts that battle from its start. Broken or old saves give a fresh start with a short message. Developers get a seed in the URL to reproduce a Run, and debug options to give gold, jump to Round N and show the route.

**Blocked by:** 07 (Two wallets and the shop)

**Status:** ready

**Touches:** adapters/storage, debug, config, main

**Effort:** low

- [ ] Storage adapter saves after every Run action and at ready-to-fight, with a version number
- [ ] Unreadable or unknown-version data gives a fresh start plus a logged warning and an on-screen message, never a crash
- [ ] `?seed=<n>` starts a Run with that seed; the same seed and actions reproduce the Run
- [ ] `?debug=1` shows buttons to give gold to either wallet, jump to Round N and toggle the route preview
- [ ] Tests: save and load round-trip through a fake storage; broken and old-version data handled
