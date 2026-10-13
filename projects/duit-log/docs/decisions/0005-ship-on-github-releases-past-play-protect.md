# Ship on GitHub Releases, with the Play Protect workaround documented

duit-log keeps shipping as a signed APK on GitHub Releases (and Previews as PR prereleases), and the README explains how to get past Google Play Protect when it blocks the install. Play Protect's enhanced fraud protection, live in Malaysia since April 2026 and in other "select markets", automatically blocks installing an app that declares `BIND_NOTIFICATION_LISTENER_SERVICE` (or SMS or accessibility permissions) from a browser, messaging app or file manager ([Google's guidance](https://developers.google.com/android/play-protect/warning-dev-guidance)). duit-log needs notification access by design ([0003](0003-notification-access-with-a-wallet-allowlist.md)), so from 0.2.0 on it is blocked there. The workarounds are "Install anyway" when offered, pausing "Scan apps with Play Protect" during the install, or `adb install`, which Play Protect doesn't check.

Android developer verification comes next: from 30 September 2026 in Brazil, Indonesia, Singapore and Thailand, and globally in 2027, a certified device installs only apps from registered developers, except through adb or the power user "advanced flow" ([FAQ](https://developer.android.com/developer-verification/guides/faq)). Registering the signing key in the Android Developer Console (a $25 full distribution account, or a free limited distribution account for up to 20 devices) must happen before verification reaches Malaysia; that is a separate ticket when the date is known.

**Considered Options:**

- **A Play Store listing.** Installs past Play Protect with no workaround, but Play's policy limits notification listener access to apps whose core purpose needs it, with a declaration and review, and needs a developer account with identity verification and, for a new personal account, a closed test with testers for two weeks before production. Too much for a personal app with a handful of users; it can be revisited if duit-log grows.
- **F-Droid.** Installing through the F-Droid client may not count as an "Internet-sideloading source", but F-Droid builds and signs the APK itself, so its builds won't update ours, and it can't produce per-PR Previews. Undocumented whether Play Protect exempts it.
- **Sideload only, as before.** Chosen, with the workaround in the README.

**Trade-offs:** in the affected countries every install, every update and every Preview needs the workaround, and pausing Play Protect is a step a stranger may reasonably be wary of. If Google removes the remaining workarounds, this decision has to be revisited.
