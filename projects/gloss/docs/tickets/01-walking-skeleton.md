# 01: Walking skeleton

**What to build:** Gloss exists as a project that a stranger can clone, build and test from the README, with CI green, and installs on the owner's phone from GitHub. Selecting text in Legado shows **Define** in the selection menu, and tapping it opens an empty card at the bottom of the screen showing the Selection; tapping outside or back closes it and Legado is where it was.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** build, ci, core-gloss, app-card

**Effort:** medium

- [ ] `core` (pure Kotlin) and `app` (Compose) modules, with the build setup copied from duit-log (not referenced): Gradle wrapper, version catalog, JDK toolchain, a setup script for the pinned Android SDK; current stable SDK versions looked up and recorded, minimum Android 10
- [ ] One passing JVM test in `core`
- [ ] `.github/workflows/gloss.yml` (`name: gloss`, scoped to `projects/gloss/`) runs ktlint, detekt, Android lint, the JVM tests and a signed release build, and is green; `ci-gate` waits for it
- [ ] On `main`, a new version name publishes GitHub Release `gloss-v<version>`; green PRs publish a `gloss-pr-<N>` prerelease with a **Gloss Preview** APK (its own application ID, labelled menu entries), deleted when the PR closes; version code is the CI run number
- [ ] A translucent activity handles `PROCESS_TEXT` as **Define**, shows a bottom sheet with the Selection, never returns text to the calling app, and closes on outside tap or back
- [ ] The card follows the phone's dark mode
- [ ] README: what Gloss is, setup, build, test, install through Obtainium (filter `^gloss-v[0-9.]+$`), the signing key and CI secrets; MIT licence; Gloss added to the root index
- [ ] Checked by hand on the phone: Define appears in Legado's selection menu and in Chrome's, and the card opens and closes

**Owner steps:** generate the Gloss release signing key on the Beelink and add the CI secrets as the README describes; install Gloss through Obtainium.
