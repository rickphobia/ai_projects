# RickNotes

An Android tablet app for studying PDFs with a pen: it writes ink beside each PDF instead of into it, and collects red-ink mistakes into an error log. Built for one owner and one tablet (Lenovo Xiaoxin Pad Pro 12.7, Android 16). The full picture is in [`docs/spec.md`](docs/spec.md).

## Status

`in progress`: tickets 01-06 (milestone 1, waiting on its check on the tablet), 07 (shareable log), 08 (first ink), 09 (saving ink), 10 (Versions), 11 (pens and highlighter), 12 (eraser, undo and redo), 13 (Lasso), 14 (palm safety and finger gestures; with these, milestone 2 waits on its check on the tablet), 15 (polished Document screen), 16 (floating Lasso menu), 17 (home screen tree), 18 (Course folders) and 24 (drop a screenshot). On first launch the app asks for "All files access", then for the Study folder. The home screen shows Recent Documents (the last 8 opened) above a browse-only tree of the Study folder that opens on the most recently used semester; folders collapse and expand, folders three levels in (`Y1/Sem1/EE2001`) show as Course folders, long-pressing a folder marks or unmarks it as one, and Ink files, `.assets`, `.versions`, `_revision_log` and temporary files are hidden. Settings has "Change folder" and "Share log", and long-pressing its title opens a hidden pen test screen. Tapping a PDF opens it as a Document that scrolls continuously from page to page; a damaged or password-protected PDF shows a message instead. The pen writes with the pen or highlighter picked in the toolbar, erases whole strokes with the eraser, or with the Lasso draws a loop round strokes to select them, then drags them elsewhere on the page or deletes them from a small menu that floats beside the selection; Undo and Redo step through the changes made since the Document was opened. One finger scrolls (and flings), two fingers pinch-zoom (1x to 5x) and pan; a finger never draws. A resting palm does nothing: fingers are ignored while the pen hovers or touches and for half a second after, and so is any contact wider than a fingertip. Settings has switches, all off at first, for Finger erase (one finger erases whole strokes instead of scrolling), two-finger tap to undo and three-finger tap to redo. Strokes stay on their spot of the page at any zoom and are saved to an Ink file beside the PDF 2 seconds after the last stroke and whenever the app goes to the background, so they are there after a force-close; a Version of the Ink file is kept on every open and every 15 minutes of writing (newest 10). A failed save shows "Not saved" until a retry works; an unreadable Ink file opens the Document read-only and is never overwritten; a PDF whose page count changed shows a warning. Pages turn sharp again a moment after the view stops moving. The Document toolbar is icons (long-press one for its name) and the app follows the tablet's dark mode, with PDF pages staying white. The page indicator ("12 / 100") jumps to a page when tapped, and each Document reopens at the page and zoom it was left at. Every merge to `main` publishes a signed APK for Obtainium, and every green pull request a signed Preview app. Next: the milestone 2 check on the tablet, then tickets for milestone 3.

## Requirements

- Linux x86-64 (the Beelink runs Ubuntu 24.04), with `curl`, `unzip` and `sha1sum`
- Java 17 or newer on the `PATH` to start Gradle and the SDK installer (`sudo apt install openjdk-21-jre-headless`). The JDK that compiles the code is pinned by the build and downloaded on first run, so the installed Java's version doesn't matter beyond that.
- About 2 GB of disk for the Android SDK, Gradle and the JDK
- No Android Studio and no accounts

## Setup

```bash
cd projects/ricknotes
scripts/setup-android-sdk.sh   # installs the pinned Android SDK into ~/Android/Sdk, writes local.properties
```

Set `ANDROID_HOME` first to put the SDK somewhere else. The script is safe to run again. Since command-line tools 23.0 the SDK installer is the `android` CLI (it replaced `sdkmanager`); on first use it unpacks itself into `~/.android/cli`. The script runs it with `--no-metrics`.

A debug build needs nothing from `.env.example`. A release or Preview build needs the signing variables (see [Signing key](#signing-key)).

## Build

```bash
./gradlew assembleDebug        # APK in app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # signed RickNotes:         app/build/outputs/apk/release/app-release.apk
./gradlew assemblePreview      # signed RickNotes Preview: app/build/outputs/apk/preview/app-preview.apk
```

The first build downloads Gradle, the JDK and the libraries, and takes a few minutes.

There are two apps from one codebase, and they install side by side, each with its own settings (so its own Study folder):

| Build type | App | Package | Built by CI from |
|------------|-----|---------|------------------|
| `release` | RickNotes | `com.rickphobia.ricknotes` | `main` |
| `preview` | RickNotes Preview | `com.rickphobia.ricknotes.preview` | pull requests |
| `debug` | RickNotes | `com.rickphobia.ricknotes` | (CI only checks it builds) |

`versionCode` and `versionName` are `RICKNOTES_BUILD_NUMBER` (CI's run number; 1 when unset), so the home screen shows the same number as the release, and the Preview app's version ends in `-preview`.

## Test

```bash
./gradlew lintAll              # ktlint, detekt, Android lint, and the "core has no Android" check
./gradlew test                 # every JVM unit test
./gradlew ktlintFormat         # fix formatting that ktlint reports
```

```bash
scripts/tests/pr-try-link.test.sh   # the script CI uses to put the Preview link in a PR body
```

CI (`.github/workflows/ricknotes.yml`) runs shellcheck, the script tests and `./gradlew lintAll test assembleDebug` on every push that changes this folder. Lint reports are in `<module>/build/reports/`; CI uploads them when a run fails. When the checks pass, it also publishes (decision [0004](docs/decisions/0004-apks-from-github-releases.md)):

- **On `main`:** a signed RickNotes APK as the GitHub Release `ricknotes-v<N>` (`N` is the run number), marked latest.
- **On a pull request:** a signed Preview APK as the prerelease `ricknotes-pr-<PR>`, replaced on every green run, and a "▶ Try this version" link to the APK on the PR body's second line. Closing or merging the PR deletes the prerelease and its tag. PRs from forks get no secrets, so they get no Preview.

## Install on the tablet

### RickNotes, through Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) installs RickNotes from GitHub Releases and updates it. Checked against Obtainium 1.6.17 (its GitHub source in `lib/app_sources/github.dart`). The repo holds other projects too, so RickNotes must be told to follow only `ricknotes-v*` releases:

1. Install Obtainium from its GitHub releases page. Allow it to install apps when Android asks ("Install unknown apps").
2. In Obtainium, **Add app**, App source URL `https://github.com/rickphobia/ai_projects`.
3. In the GitHub options, set **Filter release titles by regular expression** to `^ricknotes-v[0-9]+$`. Leave **Include prereleases** off and **Fallback to older releases** on (both are the defaults): the newest release in the repo may be a Preview or another project's, and the fallback makes Obtainium look further back for a matching one.
4. **Add**, then **Install**. Obtainium checks for updates in the background and notifies you.

Obtainium reads the version from the tag `ricknotes-v<N>` and the installed app's version is `N`, so its standard version detection matches them.

### RickNotes Preview, from a pull request

Open the "▶ Try this version" link in the PR on the tablet; it downloads the APK. Open it and allow the browser to install apps. It installs as "RickNotes Preview" beside RickNotes; point it at a copy of the Study folder. A newer Preview installs over an older one; a build with a lower number (an older PR's rerun) won't, so uninstall the Preview first.

### A local build, by hand

- **Over USB or adb:** turn on Developer options and USB debugging on the tablet, then `~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Without adb:** copy `app-debug.apk` to the tablet (Drive, USB) and open it in Files; allow "Install unknown apps" for Files when asked.

A debug build is signed with this machine's debug key, so it won't install over the RickNotes from Obtainium (or over a debug build from another machine); uninstall first, which wipes the app's settings.

## Signing key

Android installs an update only if it is signed with the same key as the installed app, so every RickNotes and Preview APK is signed with one release key. Losing it means uninstalling RickNotes (losing its settings) to install a build signed with a new one.

Generate it once, on the Beelink, outside the repo (`keytool` comes with the JDK; `sudo apt install openjdk-21-jdk-headless` if it's missing):

```bash
mkdir -p ~/keys && chmod 700 ~/keys
keytool -genkeypair -keystore ~/keys/ricknotes-release.jks -storetype PKCS12 \
  -alias ricknotes -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=RickNotes"
```

It asks for a password; with PKCS12 the key password is the same as the store password.

**Back it up:** copy `ricknotes-release.jks` and its password to somewhere off the Beelink (a password manager holds both). Without the backup, a dead disk means a new key.

**Add the GitHub secrets** (repo Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|--------|-------|
| `RICKNOTES_KEYSTORE_BASE64` | output of `base64 -w0 ~/keys/ricknotes-release.jks` |
| `RICKNOTES_KEYSTORE_PASSWORD` | the password |
| `RICKNOTES_KEY_ALIAS` | `ricknotes` |
| `RICKNOTES_KEY_PASSWORD` | the password again |

**Build a signed APK locally:** export the four `RICKNOTES_KEY*` variables from `.env.example` (with `RICKNOTES_KEYSTORE_FILE` pointing at the `.jks`), then `./gradlew assembleRelease`. Without them it fails with `Release signing is not configured: set <names>`.

## Configuration

App settings (the Study folder, Favourite pens, and the Finger erase, two-finger tap and three-finger tap switches) live in the app's private storage and are loaded, validated and saved in one place, `core/.../settings/SettingsLoader.kt`. They are not environment variables. Each Document's last page and zoom are kept separately in the private file `reading_positions`, keyed by the PDF's path (`adapters/settings/SharedPreferencesReadingPositions.kt`); a saved position is fitted to the PDF when it reopens (a page past the end goes to the last page, a zoom outside 1x to 5x is brought inside), and an unreadable one is ignored with a warning in Logcat. The Study folder is checked on every start: if it is missing, not a folder or unreadable, the app goes back to the folder picker and says which folder and why. Only folders on the tablet's own storage can be picked, not an SD card or USB drive.

Build-time values come from environment variables listed in `.env.example`:

| Variable | Required | What it does |
|----------|----------|--------------|
| `ANDROID_HOME` | no | Where the Android SDK lives. Default `~/Android/Sdk`; `local.properties` (written by the setup script) also points Gradle at it |
| `RICKNOTES_BUILD_NUMBER` | no | `versionCode` and `versionName`. Default 1; CI sets the run number |
| `RICKNOTES_KEYSTORE_FILE` | for release and Preview builds | Path to the release keystore (`.jks`) |
| `RICKNOTES_KEYSTORE_PASSWORD` | for release and Preview builds | The keystore's password |
| `RICKNOTES_KEY_ALIAS` | for release and Preview builds | The key's alias in the keystore (`ricknotes`) |
| `RICKNOTES_KEY_PASSWORD` | for release and Preview builds | The key's password |

In CI the keystore comes from the `RICKNOTES_KEYSTORE_BASE64` secret, decoded to a temporary file for the build and deleted after it.

## Pinned versions

Every version is pinned: tools and libraries in `gradle/libs.versions.toml`, Gradle in `gradle/wrapper/gradle-wrapper.properties` (with its checksum), the build JDK in `gradle/gradle-daemon-jvm.properties`, the SDK command-line tools and package revisions in `scripts/setup-android-sdk.sh`. Each was the newest stable release on 2026-10-04, checked at the source:

| What | Version | Checked at |
|------|---------|------------|
| Gradle | 9.8.0 | services.gradle.org/versions/current |
| JDK (build toolchain, Temurin via foojay) | 21 | Gradle `updateDaemonJvm` |
| Android Gradle Plugin | 9.4.1 | Google Maven `com.android.tools.build:gradle` |
| Kotlin | 2.4.20 | Maven Central `org.jetbrains.kotlin:kotlin-gradle-plugin` |
| Compose BOM | 2026.09.00 | Google Maven `androidx.compose:compose-bom` |
| Activity Compose | 1.13.0 | Google Maven `androidx.activity` |
| Core KTX | 1.19.1 | Google Maven `androidx.core` |
| Lifecycle | 2.11.0 | Google Maven `androidx.lifecycle` |
| Jetpack Ink | 1.0.0 | Google Maven `androidx.ink` |
| kotlinx.serialization JSON | 1.11.0 | Maven Central `org.jetbrains.kotlinx:kotlinx-serialization-json` |
| JUnit | 4.13.2 | Maven Central `junit:junit` |
| ktlint / ktlint Gradle plugin | 1.8.0 / 14.2.0 | Maven Central `com.pinterest.ktlint`, Gradle Plugin Portal |
| detekt | 1.23.8 (2.0 is still alpha) | Maven Central and Gradle Plugin Portal |
| foojay toolchain resolver | 1.0.0 | Gradle Plugin Portal (version in `settings.gradle.kts`) |
| SDK platform | API 37 (`android-37.0`, revision 2) | `android sdk list --all` |
| Build tools / platform tools | 37.0.0 / 37.0.1 | `android sdk list --all` |
| SDK command-line tools | 23.0 | dl.google.com/android/repository/repository2-3.xml |

The app requires API 36 (Android 16, the tablet's version) and targets API 37. Android lint's "newer version available" checks are off on purpose: a version bump is a reviewed change to these files, not a build that turns red overnight.

## How it works

Two Gradle modules:

- **`core`**: plain Kotlin on the JVM with no Android code. It will hold all the rules (Ink files, the Document session, the touch interpreter, settings). Today it has the settings model and loader, the Stroke model with screen-to-page coordinates (`ink/`), the Ink file format (`inkfile/`), the Document session that loads it and saves it through `AutoSave`, the safe write, Versions and save timing that the Revision log will reuse too (`session/`), the touch interpreter with its palm rejection and finger gestures (`touch/`), and the Study folder tree and Recent Documents (`studyfolder/`), which the home screen lists off the main thread. A build check (`:core:checkNoAndroidDependencies`, part of `check` and `lintAll`) fails if an Android library or an `android`/`androidx` import gets into it, so it always runs its tests on a plain JVM.
- **`app`**: the Android app. `MainActivity` only wires things together: it checks "All files access" on every resume (decision [0002](docs/decisions/0002-all-files-access.md)) and hands the SharedPreferences adapter to `RickNotesApp`, which picks the screen: the permission explanation, the folder picker, the home screen, Settings, or an open Document. The system folder picker returns a tree document ID (`primary:Study`), which `files/TreeDocumentPaths` turns into a normal path.

A Document is drawn by `viewer/PdfPages`, the `PdfRenderer` adapter. `PdfRenderer` isn't safe to share between threads, so each open Document gets its own render thread and every renderer call runs there. The PDF is opened with `MODE_READ_ONLY` and nothing writes to it. Drawn pages are kept in an `LruCache` limited to a quarter of the app's heap limit; a page that scrolls away before its turn on the render thread is never drawn. `viewer/PageList` lays the pages out in a `LazyColumn`, each box sized to its page's shape before the page arrives, so the list never jumps.

Zoom (`viewer/ZoomView`, 1x is the page filling the screen's width, up to 5x) makes the list wider than the screen and slides it sideways; one finger scrolls up and down (and sideways when zoomed), two fingers pinch about the point between them and pan. Whole pages are only ever drawn at the screen's width, because a whole page at 5x would be hundreds of MB; while zooming they are stretched. Once the view has been still for 250 ms, each zoomed page on screen gets a second, sharp image of just the part that shows, plus an eighth of the screen to spare (`viewer/PageDetail` decides, `PdfPages.renderPart` draws it with a transform). It is drawn over the stretched page, kept while scrolls stay inside it, and redrawn when they leave it or the zoom changes. The page filling most of the screen (the earlier one on a tie, so a page jumped or reopened to at the top stays current) is the current page, shown by `viewer/PageJump`'s indicator, and saved with the zoom half a second after either changes and again when the Document closes. Every touch on the pages goes to the ink layer over them (`ink/InkLayer`), an Android View because low-latency ink needs the raw `MotionEvent`s. It turns each one, and the pen's hover events, into plain events (`ink/RawPointer`, with the contact's width from `getTouchMajor`) for `core`'s `TouchInterpreter`, which says what it means: the pen draws (only a stylus counts as a pen), one finger scrolls (or erases, with Finger erase on, and a second finger landing calls that erase off), two fingers pinch, and two- and three-finger taps undo and redo when switched on. `core`'s `HandRejection` keeps a resting hand out: a finger that lands while the pen hovers or touches, or within `penLockoutMs` after, is ignored until it lifts, and so is one whose contact is ever wider than `maxFingertipMm`. A finger already down when the pen comes near does nothing until the pen has gone, and an erase it was making is called off. A palm the screen itself detects arrives as a pointer Android cancels, which is dropped too. The limits are in `core`'s `TouchThresholds` (0.5 s lockout, 15 mm fingertip, a tap at most 300 ms with no finger moving over 3 mm, and two fingers zoom only once their distance apart has changed by 8 mm since they landed, so a two-finger swipe only scrolls); millimetres are turned into pixels with the screen's real density. `ink/DocumentTouch` carries that out: fingers move the list through `viewer/PageNavigation` (`ink/FingerTouch`), both the pen eraser and Finger erase go through `ink/StrokeEraser`, and a pen stroke goes to Jetpack Ink's `InProgressStrokesView`, which draws it straight to the screen's front buffer for the lowest lag. The stroke belongs to the page the pen went down on (`core`'s `pageAt`; none in the gap between pages), and its points are converted to that page's PDF points as it is drawn. Once finished, Ink hands it back; it becomes a `core` Stroke kept in `ink/DocumentInk`, and each page draws its own strokes scaled to its width (`PageInk`), so they stay put while scrolling and zooming. The wet copy stays in Ink's layer until the page has drawn the stroke once (`ink/WetInkHandoff`, at most 250 ms): removing it at handover, as Ink suggests, left a frame with the stroke nowhere, which flickered on pen up.

Ink is saved by `core`'s Document session (`session/DocumentSession`), which `ink/DocumentInk` gets from `ink/InkSessions` (one session per PDF) (decision [0003](docs/decisions/0003-ink-beside-the-pdf.md)). `Week 1.pdf` gets `Week 1.pdf.ink.json`: readable JSON (`inkfile/InkFileCodec`) with a format version, the PDF's page count, the page list (`pdf-1`, `pdf-2`, ...) and the strokes, whose points are packed as difference-encoded whole numbers in text (`inkfile/PointPacking`, positions to 1/100 PDF point). A save runs 2 seconds after the last stroke, and at once when the app goes to the background or the Document closes, on the app's one save thread (`ink/SaveThread`). It writes the hidden `.Week 1.pdf.ink.json.tmp`, flushes it to disk, and renames it over the Ink file in one step, so a crash mid-save leaves the old file whole; a temporary file left behind is ignored on open and written over by the next save. A failed save keeps the strokes in memory, shows "Not saved" and retries every 5 seconds. Closing a Document saves it; if that save fails, its session stays in `InkSessions` and keeps retrying, and reopening the Document gets that same session back, so no newer ink is replaced by an older file. On open, strokes are rebuilt into Jetpack Ink meshes with the same brush. An Ink file that can't be read (bad JSON, bad points, or a newer format version) opens the Document read-only with a message, and the pen draws nothing until it is fixed.

**Versions** (`session/VersionStore`): opening a Document whose Ink file can be read copies that file into the hidden `.versions` folder beside it, before any new stroke, as `.versions/Week 1.pdf.ink.json.<time in ms>.version`. While you write, the save that comes at least 15 minutes after the last Version first takes another one of the Ink file as it was before that save. Only the newest 10 per Document are kept. Versions are written the same safe way as the Ink file (via a hidden `.tmp` file in `.versions`). A Version that can't be written doesn't stop the Document opening or saving; it is tried again at the next save. A damaged Ink file gets no Version, so it can't push a good one out. The screen to restore a Version comes in milestone 6.

**Sync app:** tell FolderSync to skip files whose names start with `.` and end with `.tmp` (filter `.*.tmp`); they are half-written saves. Also skip the `.versions` folders (filter `.versions`): Versions are per tablet, and syncing them would only multiply files. The `.ink.json` files must sync.

**Pictures** (ticket 24): dragging an image onto an open page, from the screenshot preview or from another app in split screen, places it as a Picture where it is let go. `viewer/PictureDrop` takes the drop, asks Android for read permission on the dropped content, and `imports/ReceivedImage` reads it into the app's cache, checking by decoding its header (not by the type the other app claims) that it is a PNG, JPEG or WebP of at most 50 MB; anything else shows a message and is logged with its type and size only. `core`'s `fitPicture` sizes it to at most half the page's width and height (never past one pixel per point), centred where it was let go and kept on the page; a drop in the gap between pages goes on the nearer page. The Document session copies the image into `<pdf name>.assets/` (for example `Week 1.pdf.assets/<id>.png`) through the safe write before the Ink file refers to it, then adds the Picture as one undo step in the same history as strokes. The Ink file (format version 2) lists each Picture's page, image name, position and size in PDF points; a version 1 Ink file opens with no Pictures. Undo leaves the image in `.assets`, so redo and Versions still find it. Pictures are drawn over the page and under the ink (`viewer/PagePictures`), so the pen writes over them. The original file is only read. The `.assets` folders must sync with the `.ink.json` files.

**Dragging the screenshot preview on ZUXOS:** not checked on the tablet yet. Record here whether the corner preview can be dragged into RickNotes; if it can't, Share → RickNotes (ticket 27) covers it.

A PDF that can't be opened raises `DocumentOpenException` (`Missing`, `PasswordProtected` or `Damaged`), and the screen shows its message, which names the file and the reason.

Logging goes through `logging/AppLog`, which writes every line to logcat and to a rolling file in the app's private storage (`files/logs/`): `logging/RollingLogFile` moves `ricknotes.log` to `ricknotes.1.log` when it would pass 1 MB, so the log never takes more than 2 MB. "Share log" in Settings copies both into one file in the cache and sends it through the Android share menu with a `FileProvider`. The file leaves the tablet, so it holds file names, timings and errors only: never stroke data, page images or clipboard text (the pen test screen logs to logcat only for that reason).

## Folder layout

```
core/src/main/kotlin/com/rickphobia/ricknotes/core/
  settings/            Settings model, SettingsSource port, SettingsLoader
  studyfolder/         Study folder tree listing (app files hidden), Recent Documents, which folders start open
  ink/                 Stroke and Picture models, page IDs, screen to page coordinates and back, sizing a dropped Picture
  inkfile/             Ink file model, JSON codec, point packing
  session/             Document session: load, save timing, safe write, Pictures' `.assets` folder, Clock port
  touch/               touch interpreter: plain touch events in, actions (draw, erase, scroll, pinch, undo, redo) out; palm rejection, thresholds
core/src/test/kotlin/  JUnit tests, mirroring core's packages
app/src/main/kotlin/com/rickphobia/ricknotes/
  MainActivity.kt      entrypoint: wiring only
  RickNotesApp.kt      which screen shows
  adapters/settings/   SharedPreferences-backed settings and reading-position storage
  logging/             AppLog and the rolling log file behind "Share log"
  files/               picker result to path, the PdfEntry a Document opens with
  studyfolder/         "All files access" and folder picker screens
  home/                home screen: Recent Documents row and Study folder tree (Compose)
  settings/            Settings screen ("Change folder", Favourite pens, finger gestures)
  diagnostics/         hidden pen test screen: raw stylus events, newest first
  ink/                 touch layer over the pages: MotionEvent conversion, Jetpack Ink strokes, drawing finished strokes, Document sessions and the save thread
  imports/             reading dropped content into the app and checking it is an image
  viewer/              open Document: PdfRenderer adapter, zoomable page list, Pictures and dropping them, finger navigation, page jump, reading position, open errors
app/src/test/kotlin/   JUnit tests for app code that runs on the JVM
app/src/preview/res/   the Preview app's label
config/detekt.yml      detekt rules on top of the defaults
gradle/                version catalog, wrapper, pinned daemon JDK
scripts/               setup-android-sdk.sh; pr-try-link.sh (CI's PR-body link), with tests in scripts/tests/
docs/                  spec, tickets, decisions
```

## Pen buttons

Which buttons of the Lenovo Xiaoxin Stylus 2023 reach the app on ZUXOS, as seen on the pen test screen (Settings, long-press the "Settings" title). Draw, hover or press buttons in the grey area; each row shows the event, tool type, buttons held, pressure, hover state and key code. Rows are also logged at debug level (`adb logcat RickNotes:D '*:S'`). Ticket 15 was to build the Pen button settings from this table; see the results below.

Results, 2026-10-04 (ZUXOS 1.15.10.060, Android 16):

| Button | Action tried | What the app received |
|---|---|---|
| Side button (the pen has one) | press while touching | nothing: no button state on touch events, no key event |
| Side button | press while hovering | nothing: no button state on hover events, no key event |
| Side button | press with the pen away from the screen | nothing |
| Eraser end | — | the pen has none |

ZUXOS keeps the side button for itself: by default, hold creates a note and press shows or hides the system pen menu (Settings → stylus). With both of those turned off, the button still sends nothing to apps. So no Pen button is available on this pen.

## Debugging

- The app logs to Logcat with the tag `RickNotes` (`adb logcat -s RickNotes`) and to the rolling log file that Settings → "Share log" sends.
- **The app crashes:** the crash is written to the log before the app closes (`logging/CrashRecorder`). Reopen the app, go to Settings → "Share log", and look for "crashed on thread": the full stack trace follows it.
- **Stuck on the "All files access" screen:** turn the setting on for this app (RickNotes and RickNotes Preview are listed separately), then press Back.
- **"The Study folder ... does not exist" on start:** the folder was renamed, moved or deleted; pick it again.
- **A PDF shows "Can't open ...":** the message says why. "password-protected": remove the password in another app (RickNotes doesn't ask for one). "damaged or not a PDF": Android's PDF reader couldn't parse it; check it opens elsewhere. Logcat has the underlying error. Page open and render times are logged at debug level (`adb logcat RickNotes:D '*:S'`), with "(part)" for the sharp part of a zoomed page.
- **Ink missing after reopening:** the log (logcat, or "Share log") has "loaded N strokes for <file>" on open and "saved <file>.ink.json: B bytes in T ms" after each save; "save failed" lines (error level) give the reason. Check that `<file>.ink.json` is beside the PDF and was moved with it.
- **"Not saved" stays up:** saves keep failing; the "save failed" line in the log says why (full storage, no permission to the folder). The ink is kept in memory and saved as soon as a retry works, even after the Document is closed (log: "closed <file> with ink not yet saved"); but if Android stops the app first it is lost, so fix the cause before leaving the app.
- **"can't be read ... open read-only":** the Ink file is damaged or from a newer app version. It is left untouched; copy it somewhere safe before doing anything else. Its last good copies are in the `.versions` folder beside it (newest time last); the restore screen comes in milestone 6.
- **The pen doesn't draw:** on a read-only Document it never does (see above). Otherwise a stroke starts only on a page, not in the grey gap beside or between pages (Logcat at debug level says "pen down outside any page"). Only a stylus draws; the pen test screen shows which tool type the tablet reports.
- **A finger doesn't scroll or erase, or a palm does:** every finger the touch interpreter rejects is logged at debug level with its reason (`adb logcat RickNotes:D '*:S'`): "touch N ignored: the pen is near or just lifted", or "contact X mm is wider than a fingertip (15.0 mm)". If real fingertips are rejected for size, or palms get through, tune `maxFingertipMm` or `penLockoutMs` in `core/.../touch/TouchThresholds.kt` from the sizes logged. A finger landing within half a second of the pen lifting is meant to be ignored.
- **A zoomed page stays blurry:** the sharp part is drawn only once the view has been still for 250 ms; Logcat should then show a "(part)" render for each page on screen. A "Can't draw page" error there means `PdfRenderer` failed on it, and the stretched page stays.
- **A Document reopens at the wrong place:** Logcat logs "reopening <file> at page N, zoom Z" on open. Positions are keyed by the PDF's path, so a renamed or moved PDF starts at page 1.
- **`SDK location not found`:** run `scripts/setup-android-sdk.sh`, or set `ANDROID_HOME`.
- **`Release signing is not configured: set ...`:** a release or Preview build needs the named variables; see [Signing key](#signing-key). In CI, a missing `RICKNOTES_KEYSTORE_BASE64` secret fails the signing step with its own message.
- **No Preview link on a PR:** the `preview` job in the PR's `ricknotes` run publishes it; check that run's log. A PR that doesn't touch `projects/ricknotes/` doesn't run it.
- **Obtainium finds no update or the wrong app:** check the app's **Filter release titles by regular expression** is `^ricknotes-v[0-9]+$` and **Include prereleases** is off.
- **"App not installed" on an update:** the APK is signed with a different key from the installed app (a debug build, or a new key); uninstall first.
- **`Cannot find a Java installation ... matching {languageVersion=21}`:** Gradle couldn't download the JDK (offline?). Install a JDK 21 and rerun.
- **`core must stay free of Android`:** something in `core` imports `android`/`androidx` or depends on an Android library. Move that code into an adapter in `app`.
- **ktlint failures:** `./gradlew ktlintFormat` fixes most of them.

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are, starting with [0001 (native Kotlin and Compose)](docs/decisions/0001-native-kotlin-compose.md).
