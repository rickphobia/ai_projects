# 01: Walking skeleton

**What to build:** An empty duit-log app that installs on an Android 10+ phone from a GitHub Release, with the project set up the way every later ticket expects: a pure Kotlin `core` module and an Android `app` module, one passing test, all checks green in CI, signed release APKs on `main` and a separate Preview app for every pull request. Follow `docs/new-project.md`; RickNotes is the model for the Android build, release pipeline and shareable log (copy, never reference). See decision 0001.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** build, app/screens, app/logging

**Effort:** medium

- [x] `core` (pure Kotlin, no Android imports) and `app` modules; minimum Android 10 (API 29), newest stable target SDK; current stable versions looked up and pinned in the version catalog, with where each was checked noted in the README
- [x] Storage library chosen between Room with its bundled SQLite driver and SQLDelight, by checking that the same schema runs in JVM tests and on Android; the choice and why recorded as a decision record
- [x] One JUnit test in `core` passes; one Gradle command runs ktlint, detekt, Android lint and the tests, and is named in the README
- [x] A setup script installs the pinned Android SDK so the Beelink and a cloud session can build without Android Studio
- [x] Two variants that install side by side: duit-log and duit-log Preview, each with its own data
- [x] Release signing reads the keystore and passwords from environment variables listed in `.env.example`; a build without them fails naming the missing variable; nothing secret committed
- [x] CI workflow `name: duit-log`, scoped to the project folder: checks, then a signed build; on `main` a GitHub Release `duit-log-v<version>` when the version name is new; on a green PR a `duit-log-pr-<N>` prerelease with the Preview APK linked from the PR body, deleted when the PR closes; version code is the CI run number
- [x] A rolling log file on the device with a "Share log" button on the (otherwise empty) home screen
- [x] README from the template (install from Releases, build, test, signing key setup), MIT `LICENSE` for this project, `.claude/settings.json` copied from the root, and a row in the root README's project index
- [ ] CI is green

**Owner steps:** generate the signing key on the Beelink and back it up; add the GitHub secrets; install the first release on your phone (directly or through Obtainium).
