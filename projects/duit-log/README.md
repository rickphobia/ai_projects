# duit-log

An Android money log that turns e-wallet payment notifications (Touch 'n Go eWallet, GrabPay, ShopeePay) into Transactions and sorts each one into a Category, so you can see your Income, Expenses and Total each Month. Everything stays on the phone. The full picture is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: ticket 01 (walking skeleton). The app installs on Android 10 and later and shows its version and a "Share log" button; nothing is captured yet. On start it runs a storage check (the database schema in an in-memory SQLite database) and logs the result. Every merge to `main` that raises the version name is released on GitHub, and every pull request gets a separate Preview app.

## Requirements

- Linux x86-64 (the Beelink runs Ubuntu 24.04), with `curl`, `unzip` and `sha1sum`
- Java 17 or newer on the `PATH` to start Gradle and the SDK installer (`sudo apt install openjdk-21-jre-headless`). The JDK that compiles the code is pinned by the build and downloaded on first run, so the installed Java's version doesn't matter beyond that.
- About 2 GB of disk for the Android SDK, Gradle and the JDK
- No Android Studio and no accounts

## Setup

```bash
cd projects/duit-log
scripts/setup-android-sdk.sh   # installs the pinned Android SDK into ~/Android/Sdk, writes local.properties
```

Set `ANDROID_HOME` first to put the SDK somewhere else. The script is safe to run again. Since command-line tools 23.0 the SDK installer is the `android` CLI (it replaced `sdkmanager`); on first use it unpacks itself into `~/.android/cli`. The script runs it with `--no-metrics`.

A debug build needs nothing from `.env.example`. A release or Preview build needs the signing variables (see [Signing key](#signing-key)).

## Build

```bash
./gradlew assembleDebug        # APK in app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # signed duit-log:         app/build/outputs/apk/release/app-release.apk
./gradlew assemblePreview      # signed duit-log Preview: app/build/outputs/apk/preview/app-preview.apk
```

The first build downloads Gradle, the JDK and the libraries, and takes a few minutes.

There are two apps from one codebase. They install side by side, each with its own data and settings:

| Build type | App | Package | Built by CI from |
|------------|-----|---------|------------------|
| `release` | duit-log | `com.rickphobia.duitlog` | `main` |
| `preview` | duit-log Preview | `com.rickphobia.duitlog.preview` | pull requests |
| `debug` | duit-log | `com.rickphobia.duitlog` | (CI only checks it builds) |

## Test

```bash
./gradlew checkAll             # ktlint, detekt, Android lint, the "core has no Android" check, and every JVM test
./gradlew ktlintFormat         # fix formatting that ktlint reports
scripts/tests/pr-try-link.test.sh   # the script CI uses to put the Preview link in a PR body
```

`./gradlew lintAll` runs only the linters and `./gradlew test` only the tests. Reports are in `<module>/build/reports/`.

## Releases

CI (`.github/workflows/duit-log.yml`) runs shellcheck, the script tests and `./gradlew checkAll assembleDebug` on every push that changes this folder. When the checks pass, it also publishes:

- **On `main`:** a signed duit-log APK as the GitHub Release `duit-log-v<version name>`, marked latest, but only when that release doesn't exist yet. The version name is `duitlog.versionName` in `gradle.properties`: raise it (`0.1.0` → `0.2.0`) in the PR that should reach users. A merge that doesn't raise it is checked and built but not released (the run says so in a notice).
- **On a pull request:** a signed Preview APK as the prerelease `duit-log-pr-<PR>`, replaced on every green run, and a "▶ Try this version" link to the APK on the PR body's second line. Closing or merging the PR deletes the prerelease and its tag. PRs from forks get no secrets, so they get no Preview.

The `versionCode` is CI's run number (`DUITLOG_BUILD_NUMBER`, 1 for a local build), so every build installs over the one before. The home screen shows both: "Version 0.1.0 (build 42)". A Preview's version name ends in `-preview.<build>`.

## Install on the phone

### duit-log, from GitHub Releases

Download the newest `duit-log-v*` release's APK from the repo's Releases page on the phone, open it, and allow the browser to install apps when Android asks. Updates install over it and keep your data, as long as they come from these releases (same signing key).

**With Obtainium**, which installs and updates apps from GitHub Releases ([Obtainium](https://github.com/ImranR98/Obtainium)): **Add app** with App source URL `https://github.com/rickphobia/ai_slops`, set **Filter release titles by regular expression** to `^duit-log-v[0-9.]+$`, leave **Include prereleases** off and **Fallback to older releases** on (the newest release in the repo may be another project's), then **Add** and **Install**. The tag `duit-log-v0.1.0` and the installed version name `0.1.0` match, so Obtainium's version detection works.

### duit-log Preview, from a pull request

Open the "▶ Try this version" link in the PR on the phone; it downloads the APK. Open it and allow the browser to install apps. It installs as "duit-log Preview" beside duit-log, with its own data. A newer Preview installs over an older one; a build with a lower number (an older PR's rerun) won't, so uninstall the Preview first.

### A local build, by hand

- **Over USB:** turn on Developer options and USB debugging on the phone, then `~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Without adb:** copy `app-debug.apk` to the phone and open it in Files; allow "Install unknown apps" for Files when asked.

A debug build is signed with this machine's debug key, so it won't install over duit-log from Releases; uninstall first, which deletes the app's data.

## Signing key

Android installs an update only if it is signed with the same key as the installed app, so every duit-log and Preview APK is signed with one release key. Losing it means everyone has to uninstall duit-log (losing their data unless they exported it) to install a build signed with a new one.

Generate it once, on the Beelink, outside the repo (`keytool` comes with the JDK; `sudo apt install openjdk-21-jdk-headless` if it's missing):

```bash
mkdir -p ~/keys && chmod 700 ~/keys
keytool -genkeypair -keystore ~/keys/duit-log-release.jks -storetype PKCS12 \
  -alias duit-log -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=duit-log"
```

It asks for a password; with PKCS12 the key password is the same as the store password.

**Back it up:** copy `duit-log-release.jks` and its password to somewhere off the Beelink (a password manager holds both).

**Add the GitHub secrets** (repo Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|--------|-------|
| `DUITLOG_KEYSTORE_BASE64` | output of `base64 -w0 ~/keys/duit-log-release.jks` |
| `DUITLOG_KEYSTORE_PASSWORD` | the password |
| `DUITLOG_KEY_ALIAS` | `duit-log` |
| `DUITLOG_KEY_PASSWORD` | the password again |

**Build a signed APK locally:** export the four `DUITLOG_KEY*` variables from `.env.example` (with `DUITLOG_KEYSTORE_FILE` pointing at the `.jks`), then `./gradlew assembleRelease`. Without them it fails with `Release signing is not configured: set <names>`.

## Configuration

The app has no environment variables; its settings will live on the phone (spec, "Settings"). Build-time values come from environment variables listed in `.env.example`:

| Variable | Required | What it does |
|----------|----------|--------------|
| `ANDROID_HOME` | no | Where the Android SDK lives. Default `~/Android/Sdk`; `local.properties` (written by the setup script) also points Gradle at it |
| `DUITLOG_BUILD_NUMBER` | no | `versionCode`. Default 1; CI sets the run number |
| `DUITLOG_KEYSTORE_FILE` | for release and Preview builds | Path to the release keystore (`.jks`) |
| `DUITLOG_KEYSTORE_PASSWORD` | for release and Preview builds | The keystore's password |
| `DUITLOG_KEY_ALIAS` | for release and Preview builds | The key's alias in the keystore (`duit-log`) |
| `DUITLOG_KEY_PASSWORD` | for release and Preview builds | The key's password |

In CI the keystore comes from the `DUITLOG_KEYSTORE_BASE64` secret, decoded to a temporary file for the build and deleted after it.

## Pinned versions

Every version is pinned: tools and libraries in `gradle/libs.versions.toml`, Gradle in `gradle/wrapper/gradle-wrapper.properties` (with its checksum), the build JDK in `gradle/gradle-daemon-jvm.properties`, the SDK command-line tools and package revisions in `scripts/setup-android-sdk.sh`. Each was the newest stable release on 2026-10-12, checked at the source:

| What | Version | Checked at |
|------|---------|------------|
| Gradle | 9.8.1 | services.gradle.org/versions/current |
| JDK (build toolchain, Temurin via foojay) | 21 | Gradle `updateDaemonJvm` |
| Android Gradle Plugin | 9.4.1 | Google Maven `com.android.tools.build:gradle` |
| Kotlin | 2.4.21 | Maven Central `org.jetbrains.kotlin:kotlin-gradle-plugin` |
| Compose BOM | 2026.09.00 | Google Maven `androidx.compose:compose-bom` |
| Activity Compose | 1.13.0 | Google Maven `androidx.activity` |
| Core KTX | 1.19.1 | Google Maven `androidx.core` |
| Lifecycle | 2.11.0 | Google Maven `androidx.lifecycle` |
| SQLDelight | 2.4.1 | Maven Central `app.cash.sqldelight` |
| JUnit | 4.13.2 | Maven Central `junit:junit` |
| ktlint / ktlint Gradle plugin | 1.8.0 / 14.2.0 | Maven Central `com.pinterest.ktlint`, Gradle Plugin Portal |
| detekt | 1.23.8 (2.0 is still alpha) | Maven Central and Gradle Plugin Portal |
| foojay toolchain resolver | 1.0.0 | Gradle Plugin Portal (version in `settings.gradle.kts`) |
| SDK platform | API 37.1 (`android-37.1`, revision 1) | `android sdk list --all`, stable channel in repository2-3.xml |
| Build tools / platform tools | 37.0.0 / 37.0.1 | `android sdk list --all` |
| SDK command-line tools | 23.0 | dl.google.com/android/repository/repository2-3.xml |

The app requires API 29 (Android 10) and targets API 37. Android lint's "newer version available" checks are off on purpose: a version bump is a reviewed change to these files, not a build that turns red overnight.

## How it works

Two Gradle modules:

- **`core`**: plain Kotlin on the JVM with no Android code. It will hold all the rules (the Ledger, the Notification Reader, the Daily Sort). Today it has the database schema (`src/main/sqldelight/`, compiled by SQLDelight against Android 10's SQLite; decision [0004](docs/decisions/0004-sqldelight-for-storage.md)) and `storage/StorageCheck`, which writes a row and reads it back. The schema's only table, `storage_probe`, is a placeholder that ticket 03 replaces with the Ledger's tables; it is only ever created in memory, so no phone has it on disk. A build check (`:core:checkNoAndroidDependencies`, part of `lintAll`) fails if an Android library or an `android`/`androidx` import gets into `core`.
- **`app`**: the Android app. `DuitLogApplication` starts the log and runs `storage/PhoneStorageCheck` (the same check, on the phone's SQLite) once per process. `MainActivity` only wires the home screen to "Share log".

Logging goes through `logging/AppLog`, which writes every line to logcat (tag `DuitLog`) and to a rolling file in the app's private storage (`files/logs/`): `logging/RollingLogFile` moves `duit-log.log` to `duit-log.1.log` when it would pass 1 MB, so the log never takes more than 2 MB. "Share log" copies both into one file in the cache and sends it through the Android share menu with a `FileProvider`. The file leaves the phone, so it holds steps, outcomes, counts and errors only: never notification text, Merchant names or Notes. The log folder is left out of Android's backup (`res/xml/data_extraction_rules.xml`, and `backup_rules.xml` for Android 10 and 11).

## Folder layout

```
core/src/main/sqldelight/  the database schema and queries (.sq files)
core/src/main/kotlin/com/rickphobia/duitlog/core/
  storage/             StorageCheck: proves the schema runs on a driver
core/src/test/kotlin/  JUnit tests, mirroring core's packages
app/src/main/kotlin/com/rickphobia/duitlog/
  DuitLogApplication.kt  process start: the log and the storage check
  MainActivity.kt      entrypoint: wiring only
  logging/             AppLog, the rolling log file behind "Share log", crash recording
  screens/             Compose screens and the theme
  storage/             the storage check on the phone's SQLite
app/src/test/kotlin/   JUnit tests for app code that runs on the JVM
app/src/preview/res/   the Preview app's label
config/detekt.yml      detekt rules on top of the defaults
gradle/                version catalog, wrapper, pinned daemon JDK
gradle.properties      Gradle settings and the app's version name
scripts/               setup-android-sdk.sh; pr-try-link.sh (CI's PR-body link), with tests in scripts/tests/
docs/                  spec, tickets, decisions
```

## Debugging

- The app logs to logcat with the tag `DuitLog` (`adb logcat -s DuitLog`) and to the rolling log file that "Share log" sends.
- **The app crashes:** the crash is written to the log before the app closes (`logging/CrashRecorder`). Reopen the app, tap "Share log", and look for "crashed on thread": the full stack trace follows it.
- **"storage check failed" in the log:** the phone's SQLite refused the schema or a query; the stack trace follows. A `.sq` change that only newer SQLite understands should have failed the build (decision 0004), so this points at a difference between SQLite versions; reproduce it on an Android 10 emulator.
- **`SDK location not found`:** run `scripts/setup-android-sdk.sh`, or set `ANDROID_HOME`.
- **`Release signing is not configured: set ...`:** a release or Preview build needs the named variables; see [Signing key](#signing-key). In CI, a missing `DUITLOG_KEYSTORE_BASE64` secret fails the signing step with its own message.
- **A merge to `main` made no release:** the version name wasn't raised; the `release` job's notice says so. Raise `duitlog.versionName` in `gradle.properties` in a PR.
- **No Preview link on a PR:** the `preview` job in the PR's `duit-log` run publishes it; check that run's log. A PR that doesn't touch `projects/duit-log/` doesn't run it.
- **"App not installed" on an update:** the APK is signed with a different key from the installed app (a debug build, or a new key); uninstall first.
- **`Cannot find a Java installation ... matching {languageVersion=21}`:** Gradle couldn't download the JDK (offline?). Install a JDK 21 and rerun.
- **`core must stay free of Android`:** something in `core` imports `android`/`androidx` or depends on an Android library. Move that code into `app`.
- **ktlint failures:** `./gradlew ktlintFormat` fixes most of them. SQLDelight's generated code under `core/build/generated/` is not checked.

## Licence

MIT, for this project only: see [`LICENSE`](LICENSE).

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are, starting with [0001 (on the phone only, bring your own key)](docs/decisions/0001-on-the-phone-bring-your-own-key.md).
