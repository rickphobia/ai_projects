# duit-log

An Android money log that turns e-wallet payment notifications (Touch 'n Go eWallet, GrabPay, ShopeePay) into Transactions and sorts each one into a Category, so you can see your Income, Expenses and Total each Month. Everything stays on the phone. The full picture is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: tickets 01 (walking skeleton), 02 (recorder) and 03 (Daily tab). The app installs on Android 10 and later. On first run a guide explains and requests notification access; after that it records every notification from Touch 'n Go eWallet, Grab and Shopee (and nothing else) on the Recorder screen (⋮ → Recorder), where they can be shared as a text file or cleared. The app opens on the Daily tab: the Month's Income, Expenses and Total, its Transactions grouped by day, and arrows or a swipe to move between Months. The + button adds an Expense or Income by hand. Nothing is captured into the Ledger from notifications yet. The version and "Share log" are in the ⋮ menu. Every merge to `main` that raises the version name is released on GitHub, and every pull request gets a separate Preview app.

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

The `versionCode` is CI's run number (`DUITLOG_BUILD_NUMBER`, 1 for a local build), so every build installs over the one before. The ⋮ menu on the Daily tab shows both: "Version 0.1.0 (build 42)". A Preview's version name ends in `-preview.<build>`.

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

## Notification access

duit-log reads Wallet payments from notifications, so it needs notification access. The first-run guide walks through these steps (⋮ → "Notification access guide" opens it again):

1. **Android 13 and later: allow restricted settings.** Android blocks notification access for apps installed outside the Play Store. Open duit-log's App info, tap ⋮ in the top corner, then **Allow restricted settings**, and confirm. The option often appears only after Android has blocked step 2 once; on some phones, or after an install through Obtainium, it never appears because nothing is restricted.
2. **Turn on notification access** for duit-log (Settings → Notifications → Device & app notifications / Notification access, depending on the phone).
3. **Android 12 and later: switch other apps off.** On duit-log's notification access page, open **Apps** (or **See all apps**) and switch off every app except Touch 'n Go eWallet, Grab and Shopee. Android then doesn't pass their notifications to duit-log at all.
4. **Android 13 and later: allow duit-log's own notifications**, for the Category Prompt in later versions.

If access is turned off later (an update, a battery optimiser), the Daily tab shows a banner with a button to the settings page. If access is on but Android has stopped the listener, opening the app asks Android to reconnect it (the log says "asking Android to rebind it").

## Privacy

Notification access hands the app every notification on the phone; Android has nothing narrower (decision [0003](docs/decisions/0003-notification-access-with-a-wallet-allowlist.md)). Two rules make that acceptable:

- **Anything not posted by a Wallet app is dropped at once.** The Notification Reader's first step ([`core/.../reader/NotificationReader.kt`](core/src/main/kotlin/com/rickphobia/duitlog/core/reader/NotificationReader.kt)) decides "Not a Wallet" from the posting app's package name alone and only then asks for the notification's text, so the listener ([`app/.../capture/WalletNotificationListener.kt`](app/src/main/kotlin/com/rickphobia/duitlog/capture/WalletNotificationListener.kt)) drops those without reading, saving, logging or counting them. `NotificationReaderTest` checks that a WhatsApp message and a bank alert are dropped whatever they say, and that their text is never read.
- **The AI only ever sees a Merchant name, an amount and the Category names** (from ticket 15).

The log records listener start and stop and each recorded Wallet notification's Wallet and time, never its text. The recordings stay on the phone (left out of Android's backup) until you share them.

## Wallet apps

The app accepts notifications from these packages only (`WalletApps.DEFAULT` in core, mirrored in the manifest's `<queries>` so the Recorder screen can check them):

| Wallet | Package | Confirmed on the owner's phone |
|--------|---------|--------------------------------|
| Touch 'n Go eWallet | `my.com.tngdigital.ewallet` | not yet |
| Grab | `com.grabtaxi.passenger` | not yet |
| Shopee (Malaysia) | `com.shopee.my` | not yet |

The Recorder screen lists them with "installed" or "not found on this phone". If an app you have shows "not found", its package name is different: find it in the app's Play Store link (`...details?id=<package>`) and change both `WalletApps.DEFAULT` and the manifest (`WalletAppQueriesTest` fails if they differ).

## Recorder

Milestone 1 collects the Wallets' real wording so the Notification Reader can be written from it. ⋮ → **Recorder** lists every recorded Wallet notification, newest first (app, time, title, text, expanded text). **Share** sends them all as a text file through the share menu; blank out names and amounts before passing it on. **Clear** deletes them after a confirm. A notification posted again with the same words (Wallets update notifications in place) is recorded once. The recordings live in `files/recordings/recordings.tsv` in the app's private storage, capped at 5 MB; past that, new ones are dropped, the Recorder screen says the recordings are full, and so does the log.

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

- **`core`**: plain Kotlin on the JVM with no Android code. It holds all the rules. `ledger/Ledger` is the seam the app talks to: it lists Categories, adds a Transaction by hand (refusing a bad one with a `LedgerException`) and builds a Month's summary. It takes the database and a `java.time.Clock`, whose time zone decides which day and Month a Transaction falls in. `summary/` groups a Month's Transactions by day with subtotals; `ledger/Ringgit` formats and reads amounts. Money is whole sen in a `Long`, never floating point. `reader/` is the Notification Reader's first step: a notification from an app that isn't a Wallet app is "Not a Wallet", decided before its text is fetched. The database schema is in `src/main/sqldelight/` (`category` with the default Categories inserted on first run, and `ledger_transaction`), compiled by SQLDelight against Android 10's SQLite (decision [0004](docs/decisions/0004-sqldelight-for-storage.md)). Times are stored as epoch milliseconds, so changing the phone's time zone moves Transactions between days, never in time. The tests run on a real in-memory database with a stopped clock. A build check (`:core:checkNoAndroidDependencies`, part of `lintAll`) fails if an Android library or an `android`/`androidx` import gets into `core`.
- **`app`**: the Android app. `DuitLogApplication` starts the log and holds the one `Ledger`, on the database `storage/PhoneDatabase` opens (`databases/duit-log.db`, backed up by Android's backup) and on `storage/PhoneClock`, which follows the phone's current time zone, and the one recorder store. The file is opened by the first query, which runs off the main thread, and the log records the SQLite version then. `MainActivity` wires the screens together: the first-run guide (`onboarding/`), `screens/DuitLogApp` (the Daily tab with its notification access banner, and the add screen, running every Ledger call on a background thread), and the Recorder (`capture/`). `capture/WalletNotificationListener` is the notification listener: it runs each notification through the Reader, drops "Not a Wallet" ones, and hands Wallet ones to `capture/RecordingStore`.

Logging goes through `logging/AppLog`, which writes every line to logcat (tag `DuitLog`) and to a rolling file in the app's private storage (`files/logs/`): `logging/RollingLogFile` moves `duit-log.log` to `duit-log.1.log` when it would pass 1 MB, so the log never takes more than 2 MB. "Share log" copies both into one file in the cache and sends it through the Android share menu with a `FileProvider`. The file leaves the phone, so it holds steps, outcomes, counts and errors only: never notification text, Merchant names or Notes. The log folder is left out of Android's backup (`res/xml/data_extraction_rules.xml`, and `backup_rules.xml` for Android 10 and 11).

## Folder layout

```
core/src/main/sqldelight/  the database schema and queries (.sq files)
core/src/main/kotlin/com/rickphobia/duitlog/core/
  ledger/              the Ledger, Transactions, Categories, ringgit amounts
  reader/              the Notification Reader and the Wallet apps it accepts
  summary/             a Month's totals and day groups
core/src/test/kotlin/  JUnit tests, mirroring core's packages
app/src/main/kotlin/com/rickphobia/duitlog/
  DuitLogApplication.kt  process start: the log and the Ledger
  MainActivity.kt      entrypoint: wiring only
  capture/             the notification listener and the recorder (store and screen)
  onboarding/          the first-run notification access guide and the access-missing banner
  logging/             AppLog, the rolling log file behind "Share log", crash recording
  screens/             Compose screens (Daily tab, add by hand, Month bar, ⋮ menu) and the theme
  storage/             the phone's database and clock
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
- **The app crashes:** the crash is written to the log before the app closes (`logging/CrashRecorder`). Reopen the app, tap ⋮ → "Share log", and look for "crashed on thread": the full stack trace follows it.
- **The app crashes with an `SQLiteException`:** the phone's SQLite refused the schema or a query; the crash report in the log has the stack trace, and "database opened on SQLite <version>" just before it gives the version. A `.sq` change that only newer SQLite understands should have failed the build (decision 0004), so this points at a difference between SQLite versions; reproduce it on an Android 10 emulator.
- **Save on the add screen does nothing but show a message:** the Ledger refused the entry (no Category, an amount that isn't above zero, no Merchant); the log says "add by hand refused: <reason>". A saved one logs "added EXPENSE <id> by hand".
- **Nothing is recorded:** check the Daily tab for the "can't see notifications" banner, and the log for "notification listener started". Android sometimes doesn't reconnect a listener after an update; opening the app asks it to, and switching duit-log's notification access off and on again restarts it ("notification listener stopped", then "started"). If the listener is running but a Wallet's notifications don't appear, check its package name on the Recorder screen ([Wallet apps](#wallet-apps)) and, on Android 12+, that the Wallet isn't switched off on duit-log's notification access page.
- **"Allow restricted settings" is missing:** Android shows it in App info's ⋮ menu only after it has blocked the notification access switch once. Try step 2 of the guide first.
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
