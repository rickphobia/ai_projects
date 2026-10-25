# Gloss

An Android app that explains English words and sentences you highlight in a book in Legado (an Android e-book reader), using what the book has said so far, without leaving the page. It adds **Define**, **Explain** and **Note** to Android's text-selection menu; each opens a card at the bottom of the screen over the book. The full picture is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: tickets 01 to 07 (milestones 1, Define, and 2, Explain, are complete; milestone 3 lacks the Markdown export). Selecting text in Legado, Chrome or any app that offers the selection menu shows **Define** and **Explain**; tapping Define opens a card at the bottom of the screen with the Selection and, a moment later, its meaning in a line or two. Tapping **Explain** (or **Explain more** on a Define card) gives a short, simple paragraph about what the Selection means, from Claude Sonnet 5.5, with a box under it for follow-up questions; the card grows to full height as the chat gets longer, and scrolls. Follow-ups use the same Book context and Spoiler line, and the whole chat is saved with its Lookup. When Legado's Web service is on and the Selection is in the chapter you're reading, the answer uses the book, the author, the chapter and the text before the Selection, never anything after it, and the card names the book and chapter; otherwise it answers from the Selection alone and says "No book context" and why. If there is no internet, the AI fails or Anthropic rejects the key, the card says so with **Retry**, and a rejected key also offers **Change key**. Every answer is saved as a Lookup on the phone. Tapping outside the card, swiping it down or pressing back closes it and leaves the app where it was. The card follows the phone's dark mode. Gloss's icon opens the Books screen: every book with Lookups or Notes, most recent first, with "No book" for those made without Book context, and a **Recent** tab with the newest Lookups and Notes across books. A book opens to its Book page, its Lookups and Notes in reading order by chapter, then by place in the chapter, each Note next to the Lookup it was written on; a Lookup opens to its whole chat. Notes can be edited and deleted there, and Lookups deleted, with their Notes, after a confirmation. Lookups made before 0.7.0 kept no book, so they are under "No book" unless a Note was written on them. Until a key is saved, the Books screen opens the first-run screen, which asks for your Anthropic API key and shows whether Gloss can reach Legado, and after that Settings, opened from the Books screen (this month's spend as "$0.84 of $10 this month" with the monthly Spending limit to change, Change key, the Legado check, Share log). Each AI call's cost is worked out from its tokens and the model's price (`PhoneSettings`) and counted toward the month, in the phone's time zone, even when the call then failed; past 80% of the limit the card adds a warning line, and at the limit Gloss makes no call and the card says when it resets. Every merge to `main` that raises the version name is released on GitHub, and every pull request gets a separate Preview app.

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

There are two apps from one codebase. They install side by side, each with its own data, settings and selection-menu entries (the Preview's say "Define (Preview)", "Explain (Preview)" and "Note (Preview)"):

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

`./gradlew lintAll` runs only the linters, `./gradlew :core:test` the core's tests and `./gradlew :app:testDebugUnitTest` the app's JVM tests. Reports are in `<module>/build/reports/`. The core's tests drive Define, Explain and Notes through `Gloss` with a fake AI, a fake Legado, a real in-memory database and a stopped clock; they never call Anthropic. `SpendingTest` covers the Spending limit (under and past 80%, at the limit, a failed call that cost money, the month rolling over at midnight in the phone's time zone). `ExplainTest` covers Explain (the ELI5 prompt on Sonnet, a single word, no Book context), follow-ups (the same Book context and spoiler rule on every turn, the whole chat sent and saved, a failed follow-up), Explain more, cache pricing and the limit reached mid-chat; `NoteTest` covers Notes (from the menu with its book and chapter, under "No book", attached to a Define's or an Explain's Lookup, never sent to the AI or counted as spend); `BookPagesTest` covers the Books screen's order and "No book", Book page order, Recent, opening a past Lookup, editing Notes and deleting Notes and Lookups; `LookupMigrationTest` upgrades a 0.4.0 database, one from before Notes, and one from before Book pages (a Lookup takes the book of a Note on it). The app's `ai/MessagesRequestTest` checks the request JSON: the cache marker on Explain's instructions, the chat's roles, the effort. The Legado client's tests (`app/src/test/.../legado/`) run it against a local HTTP server that answers with the replies in `app/src/test/resources/legado/` (its README says how to record fresh ones from the phone).

The Anthropic client, the card and the screens are checked by hand on the phone (spec, "Testing Decisions"): open Gloss and save your key (a wrong key is refused), then select a word and a whole sentence in Legado and in Chrome, tap **Define**, and check the card shows the Selection, a loading bar, then a one- or two-line meaning, and closes on an outside tap and on back. Turn on airplane mode and check the card says it couldn't reach Anthropic, with Retry. For Book context: with Legado's Web service on, Define a word in a book in Legado and check the card names the book and chapter; Define a word in Chrome and check it says "No book context: not found in the chapter"; switch the Web service off and check it says "No book context: Legado's Web service is off". For Explain: select a sentence in a book in Legado, tap **Explain**, and check for a short, simple paragraph and a follow-up box; ask two follow-ups (the keyboard must not cover the box) and check the card grows to full height and scrolls to the newest answer; on a Define card, tap **Explain more** and check it turns into an Explain chat on the same Selection. For Notes: select a sentence in Legado, tap **Note**, check the card names the book and chapter, type a few words, swipe the card away, tap **Note** on the same sentence again and check the words are still there, then **Save** (the card closes); on a Define and an Explain card, tap **Note** under the answer, write and save, and check it says "Note saved.". For Book pages: open Gloss, check the book you used is first on the Books screen and Recent shows the newest Lookup and Note first; open the book, check its Lookups and Notes are in reading order with the Note under its Lookup, open an Explain and check the whole chat is there; edit a Note, delete a Note, then delete a Lookup with a Note on it and check the confirmation names its Note and both are gone. In Settings, **Share log** should send a log with lines like `legado bookshelf: ok latency_ms=…`, `book context: found, passage_chars=…` and `messages model=claude-haiku-5-5 status=200 input_tokens=… output_tokens=… cache_write_tokens=0 cache_read_tokens=0 latency_ms=…` (on an Explain follow-up with Book context, `claude-sonnet-5-5` with `cache_read_tokens` above 0), and no Selection, book name or answer.

## Releases

CI (`.github/workflows/gloss.yml`) runs shellcheck, the script tests and `./gradlew checkAll assembleDebug` on every push that changes this folder. When the checks pass, it also publishes:

- **On `main`:** a signed Gloss APK as the GitHub Release `gloss-v<version name>`, marked latest, but only when that release doesn't exist yet. The version name is `gloss.versionName` in `gradle.properties`: raise it (`0.1.0` → `0.2.0`) in the PR that should reach the phone. A merge that doesn't raise it is checked and built but not released (the run says so in a notice).
- **On a pull request:** a signed Preview APK as the prerelease `gloss-pr-<PR>`, replaced on every green run, and a "▶ Try this version" link to the APK on the PR body's second line. Closing or merging the PR deletes the prerelease and its tag. PRs from forks get no secrets, so they get no Preview.

The `versionCode` is CI's run number (`GLOSS_BUILD_NUMBER`, 1 for a local build), so every build installs over the one before. A Preview's version name ends in `-preview.<build>`.

## Install on the phone

### Gloss, through Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) installs and updates apps from GitHub Releases. **Add app** with App source URL `https://github.com/rickphobia/ai_projects`, set **Filter release titles by regular expression** to `^gloss-v[0-9.]+$`, leave **Include prereleases** off and turn **Fallback to older releases** on (the newest release in the repo may be another project's), then **Add** and **Install**. The tag `gloss-v0.1.0` and the installed version name `0.1.0` match, so Obtainium's version detection works. Updates install over it and keep your data, as long as they come from these releases (same signing key).

Without Obtainium, download the newest `gloss-v*` release's APK from the repo's Releases page on the phone and open it.

Gloss asks only for internet access, which Android grants at install without a prompt; it has no notification, SMS, accessibility or location permission, so Play Protect's block on sideloaded apps with those permissions doesn't apply to it.

### First run: your Anthropic key

Open **Gloss** from the app drawer and paste an Anthropic API key (create one at console.anthropic.com → API keys). Gloss checks it with a one-token call to the Define model (a tiny fraction of a cent) and saves it only if Anthropic answers, so a mistyped key, or one with no credit, is caught here and not on the first Define. The key is encrypted with an AES key kept in the Android Keystore, so the stored copy is useless off this phone, and it is never backed up. To replace it, open Gloss and tap **Change key**; the card's **Change key** button (shown when Anthropic rejects the key) opens the same box and returns to the card once the new key is saved. Each Define is one call to Claude Haiku 5.5, a fraction of a cent. Each Explain turn is one call to Claude Sonnet 5.5, about a cent with the full 3,000 words of Book context; follow-ups read that context from Anthropic's prompt cache (for 5 minutes after the last turn) at a tenth of the price.

### First run: Legado's Web service

For answers that know your book, Gloss reads the book you're reading from Legado's Web service (decision 0001): in Legado, open **My** (我的) and turn on **Web service** (Web服务). Gloss's first screen, and Settings after it, say whether Gloss can reach it right now, and check again each time you return to the screen. Gloss asks Legado for the book you read most recently and its current chapter, finds your Selection in it, and sends the AI the book's name, author, chapter title and up to about 3,000 words before the Selection plus the rest of its paragraph. With the Web service off, Define still works, without Book context.

### Reading on public Wi-Fi

While Legado's Web service is on, it listens on the Wi-Fi too, not only inside the phone (Legado has no local-only setting): anyone on the same Wi-Fi who finds port 1122 can read your bookshelf and change your book sources.

- On Wi-Fi you don't control (a campus such as USM's, a café, a hotel), switch the Web service off, or turn Wi-Fi off and read on mobile data. Gloss then answers without Book context.
- Set up Legado's WebDav backup once (My → Backup and restore → WebDav), so a book source someone changed can be restored.
- If a local EPUB gives "No book context: Legado can't open the book's file", Legado has lost its permission to read the book's folder ("Permission Denial"): open the book in Legado again, or import its folder again.

### Gloss Preview, from a pull request

Open the "▶ Try this version" link in the PR on the phone; it downloads the APK. Open it and allow the browser to install apps. It installs as "Gloss Preview" beside Gloss, with its own data, and adds its own "Define (Preview)", "Explain (Preview)" and "Note (Preview)" entries to the selection menu. A newer Preview installs over an older one; a build with a lower number (an older PR's rerun) won't, so uninstall the Preview first.

### A local build, by hand

- **Over USB:** turn on Developer options and USB debugging on the phone, then `~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Without adb:** copy `app-debug.apk` to the phone and open it in Files; allow "Install unknown apps" for Files when asked.

A debug build is signed with this machine's debug key, so it won't install over Gloss from Releases; uninstall first, which deletes the app's data.

### Where Define and Explain show up

Android lists Gloss's entries in the menu that appears over selected text. Legado and Chrome show a few entries directly and the rest under **⋮** or **More**, so look there if **Define** or **Explain** isn't in the first row.

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

The app has no environment variables. The Anthropic key is entered on the phone (see [First run](#first-run-your-anthropic-key)). The model, Anthropic's address and API version, Legado's address (`127.0.0.1:1122`), timeouts, the retry wait and the Book context word limit are in the settings module, `app/src/main/kotlin/com/rickphobia/gloss/settings/PhoneSettings.kt`; changing one is a code change and a new build. Build-time values come from environment variables listed in `.env.example`:

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

- **`core`**: plain Kotlin on the JVM with no Android code: the Gloss core (spec, "Seam 1"). `Gloss` is the one entry point the card uses: `define(Selection)` finds the Book context (`context/BookContextFinder`), builds the prompt (`define/DefinePrompt`), asks the AI, saves an answer as a Lookup and returns what the card shows, an answer with the Book context it used or why there was none, or a failure (`DefineResult`). `explain(Selection)`, `explainMore(Selection, BookContextResult)` (a Define's Selection and context, so Legado isn't asked again) and `followUp(ExplainChat, question)` do the same for an Explain chat (`ExplainResult`), with `explain/ExplainPrompt`: every turn sends the same instructions and Book context, marked for prompt caching, then the whole chat so far. Both prompts share `context/BookContextPrompt` (the book, the marked passage and the spoiler rule); `MeteredAi` is the AI behind the Spending limit for every call. The Book context rule takes the book with the newest `durChapterTime`, fetches its current chapter and finds the Selection in it with `context/ChapterMatch`, which compares both in a canonical form (one space for any run of whitespace, straight quotes, one `-` for any dash) and, when the Selection occurs more than once, takes the occurrence nearest the reading position (`durChapterPos`). It reaches the outside world only through ports: `ai/Ai` (one prompt with the chat so far in, the answer and token usage, cache writes and reads included, or an `AiFailure` out), `context/Legado` (the bookshelf, and a chapter's text, or a `LegadoFailure`), `lookup/LookupStore`, `settings/SettingsSource` and a `java.time.Clock`. A failure is not saved as a Lookup. `spending/Spending` prices each call from its token usage (millionths of a dollar), keeps it through `spending/SpendStore` (`SqlSpendStore`, table `spend`, added to existing phones by the migration `1.sqm`) and sums the calendar month in the clock's time zone; `Gloss` checks the limit before every call and returns `DefineResult.LimitReached` with the reset date instead of calling. `bookpage/BookPages` builds the Books screen, each Book page (by chapter index, then position in the chapter, from the `BookLocation` saved with each Lookup and Note) and Recent, and edits and deletes Notes and Lookups. `lookup/SqlLookupStore` is the store on SQLite: the schema is `src/main/sqldelight/` (`lookup`: Selection, answer, time as epoch milliseconds, kind `define` or `explain`, and the book, chapter and place, added by `4.sqm`; `follow_up`: an Explain chat's questions and answers, added by `2.sqm`; `note`: Notes, added by `3.sqm`), compiled by SQLDelight against Android 10's SQLite as in duit-log, so SQL the oldest supported phone can't run fails the build. A build check (`:core:checkNoAndroidDependencies`, part of `lintAll`) fails if an Android library or an `android`/`androidx` import gets into `core`.
- **`app`**: the Android app, thin adapters around the core, wired together in `GlossApplication`.
  - `books/BooksActivity` is the launcher screen: the Books screen with its Recent tab, Book pages and past Lookups (`books/BooksViewModel` loads them from `Gloss.bookPages` off the main thread and keeps which is open). It opens Settings, and the first-run key screen until a key is saved.
  - `card/CardActivity` is the card: a translucent window, kept out of Recents, that reads the text Android hands it with `PROCESS_TEXT` and shows `card/SelectionCard` (a Material 3 bottom sheet) in `card/GlossTheme` (light or dark, following the phone). `card/CardViewModel` runs the Define or the Explain chat on a background thread and survives rotation, so turning the phone doesn't pay twice; `card/ExplainChatView` shows the chat and the follow-up box. Each selection-menu entry is an `<activity-alias>` of it in the manifest (`.card.Define`, `.card.Explain`), and the card tells them apart by the alias that started it. `ai/AnthropicClient` sends the prompt (`ai/MessagesRequest` builds the JSON: Explain's instructions as one text block with `cache_control`, its effort in `output_config`). It never sets a result: a `PROCESS_TEXT` activity that returns text would replace the Selection in the reader.
  - `ai/AnthropicClient` is the AI port on Anthropic's Messages API (`HttpURLConnection` and Android's `org.json`, no SDK): connect and read timeouts, one retry after a second when it couldn't connect (not after the request went out, since Anthropic may already have run and billed it), HTTP 401 or 403 as a rejected key, anything else as an AI error. It also checks a new key with a one-token Messages call.
  - `legado/LegadoClient` is the Legado port on Legado's web service, `GET /getBookshelf` and `GET /getBookContent?url=…&index=…` on `127.0.0.1:1122` (`HttpURLConnection` and `org.json`): a refused connection is "Web service off", a timeout is "slow", `isSuccess: false` with "Permission Denial" is "can't open the book's file", and any other `isSuccess: false`, HTTP error, broken-off or unreadable reply is an error. A bookshelf entry without a book URL or name is left out. `res/xml/network_security_config.xml` allows plain HTTP to `127.0.0.1` only, since the web service has no HTTPS; everything else stays HTTPS-only.
  - `settings/` holds `PhoneSettings` (the settings module), `ApiKeyStore` (the key, AES-GCM with a Keystore key, ciphertext in private shared preferences) and `SettingsActivity`: the key box on first run or after Change key, then Settings, both with the Legado check.
  - `logging/RollingLog` is the log "Share log" sends: `files/logs/gloss.log` plus the one file before it, about 256 KB each, also echoed to logcat (tag `Gloss`). It records the model, tokens, latency, retries, HTTP status and Anthropic's error type, the card opening, and crashes, never the Selection, the answer or the key. Share log copies it to the cache and hands it out through a `FileProvider` limited to that copy.
  - `storage/PhoneDatabase` opens `gloss.db` with SQLDelight's Android driver.
  - Nothing is backed up (`res/xml/data_extraction_rules.xml`, and `backup_rules.xml` for Android 10 and 11): the key, the database and the log stay on the phone.

```
core/src/main/kotlin/com/rickphobia/gloss/core/   Gloss, Selection, and the ports: ai/, context/ (Legado, the Book context rule), lookup/, note/, settings/; define/ prompts; bookpage/
core/src/main/sqldelight/                         the database schema and queries (.sq files)
core/src/test/kotlin/...                          the core's JVM tests
app/src/main/kotlin/com/rickphobia/gloss/         GlossApplication and the adapters: books/, card/, ai/, legado/, settings/, logging/, storage/
app/src/test/kotlin/...                           the app's JVM tests (the rolling log, the Legado client)
app/src/test/resources/legado/                    Legado's replies the Legado client's tests serve
app/src/main/res/                                 strings, themes, icon, backup rules, the log's FileProvider paths, the network security config
app/src/preview/res/                              Gloss Preview's labels
scripts/                                          SDK setup, the PR-body link script and its test
config/detekt.yml                                 detekt rules on top of its defaults
```

## Troubleshooting

Open Gloss, tap **Share log** and read the newest lines.

- **The key box says Anthropic refused the test call:** the log's `key check` line has the error type, such as `invalid_request_error` for an account with no credit. Add credit or use another key.
- **"Anthropic didn't accept your key":** the log has `status=401` (wrong or revoked key) or `status=403` (the key's workspace can't use the model). Tap **Change key** and paste a working key.
- **"Couldn't reach Anthropic":** the log has `couldn't connect` or `network error` lines with the reason (no route, DNS, timeout). Gloss retries a failed connection once after a second; check the phone's connection and tap Retry.
- **"The AI couldn't answer just now":** the log has the HTTP status and Anthropic's error type, such as `overloaded_error` (529, busy: try again) or `invalid_request_error` (400: the request itself is wrong, which needs a code fix, such as a retired model name in `PhoneSettings`).
- **"No book context: Legado's Web service is off":** the log has `legado bookshelf: web service off`. Turn on the Web service in Legado (My → Web service); Gloss's own screen shows whether it can reach it.
- **"No book context: Legado didn't answer in time":** the log has `no answer within the timeout`. Legado was busy (a large local EPUB's chapter on first open); Define again. The timeouts are in `PhoneSettings.legado`.
- **"No book context: Legado can't open the book's file":** the log has `Permission Denial`. Open the book in Legado again, or import its folder again.
- **"No book context: not found in the chapter":** the log has `book context: none, reason=NotInChapter`. Expected outside Legado; in Legado, the Selection wasn't in the current chapter of the book read most recently.
- **The key box appears again after a phone restore:** the Keystore key doesn't survive a restore, so the saved key can't be decrypted; the log says so. Paste the key again.

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
| Lifecycle (runtime, ViewModel) | 2.11.0 | Google Maven `androidx.lifecycle` |
| kotlinx.coroutines | 1.11.0 (checked 2026-10-25) | Maven Central `org.jetbrains.kotlinx:kotlinx-coroutines-core` |
| SQLDelight | 2.4.1 (checked 2026-10-25) | Maven Central `app.cash.sqldelight` |
| JUnit | 4.13.2 | Maven Central `junit:junit` |
| org.json (app JVM tests only) | 20260814 (checked 2026-10-25) | Maven Central `org.json:json` |
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
