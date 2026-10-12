# 22: Installing past Play Protect

**What to build:** A stranger, or the owner installing a Preview, can install duit-log even when Google Play Protect blocks it, by following the README. On 2026-10-12 the owner's phone (Malaysia) installed 0.1.0 from GitHub Releases without trouble. Play Protect then blocked 0.2.0, the first version that asks for notification access. The likely cause is Play Protect's enhanced fraud protection. It blocks apps that request notification access, SMS or accessibility when they come from a browser, chat app or file manager, often with no "Install anyway". Installs over USB with adb aren't covered. The block applies only at install time: an installed duit-log keeps working with Play Protect on, but every update and every Preview APK is a new install and gets blocked again. This affects every user in the affected countries, so the README must cover it and the way duit-log is distributed gets a decision record.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** docs

**Effort:** low

- [ ] Confirm from Google's own documentation how Play Protect's sideloading block works today: which permissions trigger it, which countries it covers, and which install sources are exempt (adb, Obtainium, other installer apps). Also check how Android's developer verification rules for sideloaded apps affect duit-log, and when. Cite the pages in the PR body. Where the docs and the description above disagree, the docs win; fix the README and decision record to match.
- [ ] README "Install on the phone" gets a "Play Protect blocks the install" section:
  - what the user sees and why
  - "Install anyway" if offered
  - pause **Scan apps with Play Protect** (Play Store → profile → Play Protect → gear), install, then turn it back on
  - install over USB with `adb install -r` from a downloaded release APK
  - that the installed app keeps working with Play Protect back on
  - that each update and each Preview needs the same steps again
- [ ] README "duit-log Preview" section points to the same workaround
- [ ] Decision record `0005`: duit-log keeps shipping as an APK on GitHub Releases, with the Play Protect workaround documented. Considered options: a Play Store listing (notification access policy, developer account and verification), F-Droid, staying sideload-only. Trade-off: every install and update needs the workaround in the affected countries.
- [ ] Spec: add the Play Protect block to the notes beside the "Allow restricted settings" note, and extend user story 3 to cover it
- [ ] Ticket 20's install-steps criterion includes getting past Play Protect

**Owner steps:** say which workaround got 0.2.0 installed (paused Play Protect, adb or "Install anyway") and what the block message said word for word. Optionally, try installing the next release through Obtainium with Play Protect on and report whether it was blocked, so the README can say whether Obtainium works.
