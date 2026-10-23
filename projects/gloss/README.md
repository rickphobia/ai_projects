# Gloss

An Android app that explains English words and sentences you highlight in a book in Legado (an Android e-book reader), using what the book has said so far, without leaving the page. It adds **Define**, **Explain** and **Note** to Android's text-selection menu; each opens a card at the bottom of the screen over the book. The full picture is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: ticket 01 (walking skeleton). Selecting text in Legado, Chrome or any app that offers the selection menu shows **Define**; tapping it opens an empty card at the bottom of the screen showing the Selection. Tapping outside the card, swiping it down or pressing back closes it and leaves the app where it was. The card follows the phone's dark mode. There is no AI yet, and no app screen: Gloss has no icon in the app drawer until the first-run screen arrives. Every merge to `main` that raises the version name is released on GitHub, and every pull request gets a separate Preview app.

## Requirements

- Linux x86-64 (the Beelink runs Ubuntu 24.04), with `curl`, `unzip` and `sha1sum`
- Java 17 or newer on the `PATH` to start Gradle and the SDK installer (`sudo apt install openjdk-21-jre-headless`). The JDK that compiles the code is pinned by the build and downloaded on first run, so the installed Java's version doesn't matter beyond that.
- About 2 GB of disk for the Android SDK, Gradle and the JDK
- No Android Studio and no accounts

## Setup

```bash
cd projects/gloss
scripts/setup-android-sdk.sh   # installs the pinned Android SDK into ~/Android/Sdk, writes local.properties
```

Set `ANDROID_HOME` first to put the SDK somewhere else. The script is safe to run again. Since command-line tools 23.0 the SDK installer is the `android` CLI (it replaced `sdkmanager`); on first use it unpacks itself into `~/.android/cli`. The script runs it with `--no-metrics`.

A debug build needs nothing from `.env.example`. A release or Preview build needs the signing variables (see [Signing key](#signing-key)).

## Build

```bash
./gradlew assembleDebug        # APK in app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # signed Gloss:         app/build/outputs/apk/release/app-release.apk
./gradlew assemblePreview      # signed Gloss Preview: app/build/outputs/apk/preview/app-preview.apk
```

The first build downloads Gradle, the JDK and the libraries, and takes a few minutes.

There are two apps from one codebase. They install side by side, each with its own data, settings and selection-menu entries (the Preview's say "Define (Preview)"):

| Build type | App | Package | Built by CI from |
|------------|-----|---------|------------------|
| `release` | Gloss | `com.rickphobia.gloss` | `main` |
| `preview` | Gloss Preview | `com.rickphobia.gloss.preview` | pull requests |
| `debug` | Gloss | `com.rickphobia.gloss` | (CI only checks it builds) |

## Test

```bash
./gradlew checkAll             # ktlint, detekt, Android lint, the "core has no Android" check, and every JVM test
./gradlew ktlintFormat         # fix formatting that ktlint reports
scripts/tests/pr-try-link.test.sh   # the script CI uses to put the Preview link in a PR body
```

`./gradlew lintAll` runs only the linters and `./gradlew :core:test` only the tests. Reports are in `<module>/build/reports/`. The card itself is checked by hand on the phone (spec, "Testing Decisions"): select text in Legado and in Chrome, tap **Define**, and check the card opens, shows the Selection, and closes on an outside tap and on back.

## Releases

CI (`.github/workflows/gloss.yml`) runs shellcheck, the script tests and `./gradlew checkAll assembleDebug` on every push that changes this folder. When the checks pass, it also publishes:

- **On `main`:** a signed Gloss APK as the GitHub Release `gloss-v<version name>`, marked latest, but only when that release doesn't exist yet. The version name is `gloss.versionName` in `gradle.properties`: raise it (`0.1.0` → `0.2.0`) in the PR that should reach the phone. A merge that doesn't raise it is checked and built but not released (the run says so in a notice).
- **On a pull request:** a signed Preview APK as the prerelease `gloss-pr-<PR>`, replaced on every green run, and a "▶ Try this version" link to the APK on the PR body's second line. Closing or merging the PR deletes the prerelease and its tag. PRs from forks get no secrets, so they get no Preview.

The `versionCode` is CI's run number (`GLOSS_BUILD_NUMBER`, 1 for a local build), so every build installs over the one before. A Preview's version name ends in `-preview.<build>`.

## Install on the phone

### Gloss, through Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) installs and updates apps from GitHub Releases. **Add app** with App source URL `https://github.com/rickphobia/ai_projects`, set **Filter release titles by regular expression** to `^gloss-v[0-9.]+$`, leave **Include prereleases** off and turn **Fallback to older releases** on (the newest release in the repo may be another project's), then **Add** and **Install**. The tag `gloss-v0.1.0` and the installed version name `0.1.0` match, so Obtainium's version detection works. Updates install over it and keep your data, as long as they come from these releases (same signing key).

Without Obtainium, download the newest `gloss-v*` release's APK from the repo's Releases page on the phone and open it.

Gloss asks for no permissions (no notifications, SMS, accessibility or location), so Play Protect's block on sideloaded apps with those permissions doesn't apply to it.

### Gloss Preview, from a pull request

Open the "▶ Try this version" link in the PR on the phone; it downloads the APK. Open it and allow the browser to install apps. It installs as "Gloss Preview" beside Gloss, with its own data, and adds its own "Define (Preview)" entry to the selection menu. A newer Preview installs over an older one; a build with a lower number (an older PR's rerun) won't, so uninstall the Preview first.

### A local build, by hand

- **Over USB:** turn on Developer options and USB debugging on the phone, then `~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Without adb:** copy `app-debug.apk` to the phone and open it in Files; allow "Install unknown apps" for Files when asked.

A debug build is signed with this machine's debug key, so it won't install over Gloss from Releases; uninstall first, which deletes the app's data.

### Where Define shows up

Android lists Gloss's entries in the menu that appears over selected text. Legado and Chrome show a few entries directly and the rest under **⋮** or **More**, so look there if **Define** isn't in the first row.

## Signing key

Android installs an update only if it is signed with the same key as the installed app, so every Gloss and Preview APK is signed with one release key. Losing it means uninstalling Gloss (and its data) to install a build signed with a new one.

Generate it once, on the Beelink, outside the repo (`keytool` comes with the JDK; `sudo apt install openjdk-21-jdk-headless` if it's missing):

```bash
mkdir -p ~/keys && chmod 700 ~/keys
keytool -genkeypair -keystore ~/keys/gloss-release.jks -storetype PKCS12 \
  -alias gloss-release -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Gloss"
```

It asks for a password; with PKCS12 the key password is the same as the store password. The alias is `gloss-release` rather than `gloss` because GitHub hides every secret's value in CI logs, and `gloss` appears in nearly every line.

**Back it up:** copy `gloss-release.jks` and its password to somewhere off the Beelink (a password manager holds both).

**Add the GitHub secrets** (repo Settings → Secrets and variables → Actions → New repository secret), or with `gh secret set <name>` from the repo:

| Secret | Value |
|--------|-------|
| `GLOSS_KEYSTORE_BASE64` | output of `base64 -w0 ~/keys/gloss-release.jks` |
| `GLOSS_KEYSTORE_PASSWORD` | the password |
| `GLOSS_KEY_ALIAS` | `gloss-release` |
| `GLOSS_KEY_PASSWORD` | the password again |

Until they are set, CI's signed build fails with `The GLOSS_KEYSTORE_BASE64 secret is not set`.

**Build a signed APK locally:** export the four `GLOSS_KEY*` variables from `.env.example` (with `GLOSS_KEYSTORE_FILE` pointing at the `.jks`), then `./gradlew assembleRelease`. Without them it fails with `Release signing is not configured: set <names>`.

## Configuration

The app has no environment variables; its settings will live on the phone (spec, "Storage and settings"). Build-time values come from environment variables listed in `.env.example`:

| Variable | Required | What it does |
|----------|----------|--------------|
| `ANDROID_HOME` | no | Where the Android SDK lives. Default `~/Android/Sdk`; `local.properties` (written by the setup script) also points Gradle at it |
| `GLOSS_BUILD_NUMBER` | no | `versionCode`. Default 1; CI sets the run number |
| `GLOSS_KEYSTORE_FILE` | for release and Preview builds | Path to the release keystore (`.jks`) |
| `GLOSS_KEYSTORE_PASSWORD` | for release and Preview builds | The keystore's password |
| `GLOSS_KEY_ALIAS` | for release and Preview builds | The key's alias in the keystore (`gloss-release`) |
| `GLOSS_KEY_PASSWORD` | for release and Preview builds | The key's password |

In CI the keystore comes from the `GLOSS_KEYSTORE_BASE64` secret, decoded to a temporary file for the build and deleted after it.

## How it works

Two Gradle modules, set up like duit-log's (copied, not shared):

- **`core`**: plain Kotlin on the JVM with no Android code; it will hold the Gloss core (spec, "Seam 1"). For now it holds `Selection`, the highlighted text with the whitespace around it dropped (or none, when nothing was selected). A build check (`:core:checkNoAndroidDependencies`, part of `lintAll`) fails if an Android library or an `android`/`androidx` import gets into `core`.
- **`app`**: the Android app. `card/CardActivity` is the one activity: a translucent window, kept out of Recents, that reads the text Android hands it with `PROCESS_TEXT` and shows `card/SelectionCard` (a Material 3 bottom sheet) in `card/GlossTheme` (light or dark, following the phone). Each selection-menu entry is an `<activity-alias>` of it in the manifest (only `.card.Define` so far), so later entries can share the card and tell which one was tapped. It never sets a result: a `PROCESS_TEXT` activity that returns text would replace the Selection in the reader. Nothing is backed up (`res/xml/data_extraction_rules.xml`, and `backup_rules.xml` for Android 10 and 11): the key, Lookups and Notes are meant to stay on the phone. The log goes to logcat (tag `Gloss`) and never contains the Selection.

```
core/src/main/kotlin/com/rickphobia/gloss/core/   Selection
core/src/test/kotlin/...                          its JVM tests
app/src/main/kotlin/com/rickphobia/gloss/card/    the selection-menu card
app/src/main/res/                                 strings, theme, icon, backup rules
app/src/preview/res/                              Gloss Preview's labels
scripts/                                          SDK setup, the PR-body link script and its test
config/detekt.yml                                 detekt rules on top of its defaults
```

## Pinned versions

Every version is pinned: tools and libraries in `gradle/libs.versions.toml`, Gradle in `gradle/wrapper/gradle-wrapper.properties` (with its checksum), the build JDK in `gradle/gradle-daemon-jvm.properties`, the SDK command-line tools and package revisions in `scripts/setup-android-sdk.sh`. Each was the newest stable release on 2026-10-24, checked at the source:

| What | Version | Checked at |
|------|---------|------------|
| Gradle | 9.8.2 | services.gradle.org/versions/current |
| JDK (build toolchain, Temurin via foojay) | 21 | Gradle `updateDaemonJvm` |
| Android Gradle Plugin | 9.4.1 | Google Maven `com.android.tools.build:gradle` |
| Kotlin | 2.4.21 | Maven Central `org.jetbrains.kotlin:kotlin-gradle-plugin` |
| Compose BOM | 2026.09.00 | Google Maven `androidx.compose:compose-bom` |
| Activity Compose | 1.13.0 | Google Maven `androidx.activity` |
| Core KTX | 1.19.1 | Google Maven `androidx.core` |
| Lifecycle | 2.11.0 | Google Maven `androidx.lifecycle` |
| JUnit | 4.13.2 | Maven Central `junit:junit` |
| ktlint / ktlint Gradle plugin | 1.8.0 / 14.2.0 | Maven Central `com.pinterest.ktlint`, Gradle Plugin Portal |
| detekt | 1.23.8 (2.0 is still alpha) | Maven Central and Gradle Plugin Portal |
| foojay toolchain resolver | 1.0.0 | Gradle Plugin Portal (version in `settings.gradle.kts`) |
| SDK platform | API 37.0 (`android-37.0`, revision 2); see below | stable channel in dl.google.com/android/repository/repository2-3.xml |
| Build tools / platform tools | 37.0.0 / 37.0.1 | repository2-3.xml |
| SDK command-line tools | 23.0 | repository2-3.xml |

The newest stable platform is API 37.2, but AGP 9.4.1 compiles against `android-37.0` whatever minor version the `compileSdk { release(37) { minorApiLevel = … } }` block asks for: with only `android-37.2` installed, it downloaded `android-37.0` itself (checked 2026-10-24). So the pin is 37.0, the platform the build really uses, and the setup script installs that. Raise it when an AGP release honours the minor version.

The app requires API 29 (Android 10) and targets API 37. Android lint's "newer version available" checks are off on purpose: a version bump is a reviewed change to these files, not a build that turns red overnight.

## Licence

MIT; see [`LICENSE`](LICENSE).
