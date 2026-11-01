# History: ai_projects (repo root)

Why things in the root docs (`CLAUDE.md`, `README.md`, `docs/`) and the shared skills (`.claude/skills/`) changed, and what they said before. Read it when you need the reason behind a rule or fact. Main files say what's true now.

## CLAUDE.md

### How to work here

- **2026-11-01: heading and lead-in made plain.** Was "## Your role: senior DevOps engineer, not an amateur vibe coder" followed by "Act like a senior engineer who will be paged at 3am if this breaks. In practice:". Why: current models don't need role framing; the bullets are the real rules and are unchanged. Owner's call (doc-audit).

### Hosting and how we work here

- **2026-11-01: "Every PR has a preview" cut to the rule plus a pointer.** Was: "…The session publishes an Artifact for it (`/implement` step 5). A build too big for an Artifact gets the "No Artifact preview" placeholder, and the Beelink preview timer (`scripts/previews.sh`, see "Previews on the Beelink" in `docs/workflow.md`) builds each green PR with `scripts/try-pr.sh`, writes its link into the PR body, and stops the preview and removes its worktree once the PR is merged or closed. … A new web project must be added to `scripts/try-pr.sh` to get previews." Why: the file loads every session and only PR-opening tasks need the detail, which lives in `/implement` step 5, `docs/workflow.md` ("Previews on the Beelink", now also saying the worktree is removed) and `docs/new-project.md`. It also implied the timer only acts on the placeholder; `scripts/previews.sh` replaces any `▶` line, Artifact link included, and the owner confirmed the Beelink link should win (doc-audit).

### Hosting and how we work here › Keep dev cost low

- **2026-11-01: names the agent exceptions.** Was "no agents or workflows unless asked (`/grilling`'s `fact-finder` lookups are the exception)". Why: `/review-diff` always starts two sub-agents (and `/implement` runs it on its own above 400 lines), and Design It Twice starts 3+, so the rule contradicted the skills. Owner's call: name them as exceptions rather than cut the agents (doc-audit).

### When finishing work on a project

- **2026-11-01: the project README's status counts too.** Was "Status in the root index is up to date." Why: the root index said `working` for six projects whose own README › Status still said `in progress`, because only the index was named. In the same change those six READMEs (against-all-tod, ascii-sky, court-booker, gloss, my-piggy, rss-news) became `working`, and duit-log's list now says ticket 06 is done apart from TNG's wordings (its ticket is still `ready`, waiting on recorded samples) and adds tickets 21 and 22. Owner's call: keep status in both places (doc-audit).

## README.md

### Working on a project

- **2026-11-01: sessions start at the repo root.** Was "Start Claude Code **inside the project folder**" (`cd ai_projects/projects/my-project && claude`), saying it loads the project's own `CLAUDE.md` and `.mcp.json`. Why: the owner starts local sessions at the root, as `CLAUDE.md`, `docs/workflow.md` step 1 and `scripts/next-tickets.sh` already did; no project has its own `CLAUDE.md` or `.mcp.json` (checked 1 Nov 2026).

### Project index

- **2026-11-01: statuses updated.** Was `in progress` for every project except pawn-swarm. Now `working` for my-piggy, court-booker, rss-news, ascii-sky, against-all-tod and gloss (all their tickets done); ricknotes, duit-log (tickets 06–20 ready) and happy-cotton (tickets 38–41 ready) stay `in progress`. Owner's answer (doc-audit).

## docs/workflow.md

### Starting tickets with `scripts/next-tickets.sh`

- **2026-11-01: split into lists; dated incident moved here.** Was "RickNotes sets 1, because each Android build takes 2–4 GB and most of the CPU; on 2026-10-23 two at once, beside two web tickets, filled the swap." Why: the main file keeps the guard ("two at once beside web tickets fill the swap"); the 2026-10-23 incident is the evidence behind it.

### Previews on the Beelink

- **2026-11-01: says the timer replaces any `▶` line.** Was "replacing the session's "No Artifact preview" placeholder", and opened with "my-piggy's build is too big for a `▶ Try this version` link, so the Beelink serves every PR itself". Why: `scripts/previews.sh` (`body_with_link`) replaces the first `▶` line, Artifact link included, and serves every web project in `scripts/try-pr.sh`, not only my-piggy. The owner confirmed the Beelink link should win (doc-audit).

### Keeping token use down

- **2026-11-01: lists the agent exceptions.** Was "The `fact-finder` lookups above are the one exception." Why: see `CLAUDE.md` › Keep dev cost low.
- **2026-11-01: "Keep `CLAUDE.md` short" merged into "Habits that prevent slop".** It was in both sections; its cost reason ("loaded into every session, so each extra line is paid for every time") moved with it.

## .claude/skills/to-tickets/SKILL.md

### 5. Write the tickets

- **2026-11-01: says how tickets reach `main`, and which branch names to avoid.** Was "Commit the ticket files on their own (`<name>: Add tickets for <feature>`) so every parallel session starts from the same list." Why: `scripts/next-tickets.sh` reads tickets from `origin/main` and treats a `<project>/<NN>-…` branch as ticket NN in progress, so a docs branch with that name blocks the ticket. The guard was only in Claude's memory. The practice (one spec-and-tickets PR on `<project>/<feature>-spec`, e.g. #310, #317) is now written down. Owner's call (doc-audit).

### 3. Draft vertical slices

- **2026-11-01: upstream CAPS made plain.** Was "a narrow but COMPLETE path … vertical, NOT a horizontal slice". Why: current models don't need the emphasis. Owner's call (doc-audit), accepting a slightly wider diff from upstream.

## .claude/skills/to-spec/SKILL.md

### Intro and Implementation Decisions

- **2026-11-01: CAPS made plain; seam check allowed.** Was "Do NOT interview the user; just synthesize what you already know." and "Do NOT include specific file paths or code snippets. They may end up being outdated very quickly." Why: step 2 asks the user to confirm the seams, which `tdd` relies on, so "no interview" contradicted it. The CAPS change was the owner's call (doc-audit).

## .claude/skills/implement/SKILL.md

### Finish

- **2026-11-01: says the 400-line review threshold is deliberate.** Was the same rule without "That covers most full-size tickets (they aim for ~500 lines), on purpose." Why: the 400 threshold (2 Oct) predates the ~500-line ticket aim (3 Oct), so it looked like an oversight. The owner confirmed it stays (doc-audit).

## .claude/skills/tdd/SKILL.md

### Intro

- **2026-11-01: cut a "be thorough" line.** Was "Every section applies on every cycle: consult them before and during the loop, not after." Why: scaffolding for older models; the sections apply anyway.

## .claude/skills/pr/SKILL.md

### Title

- **2026-11-01: repo-wide PRs get no prefix.** Was only "`<project-name>: <imperative summary>`". Why: repo-wide PR titles were mixed (#313 "repo: …", #320 none). The owner chose no prefix, matching `CLAUDE.md` › Git (doc-audit).

## docs/new-project.md

### Steps, step 3

- **2026-11-01: says why the settings copy still matters.** Was "Claude Code reads that file only from the folder a session starts in, so without the copy a session started in the project has none of the guardrails." Why: sessions now start at the repo root (see `README.md` › Working on a project), so the copy only guards a session started inside the project folder. Owner's call: keep the copies and the CI check (doc-audit).

## .claude/skills/codebase-design/DEEPENING.md

### Testing strategy: replace, don't layer

- **2026-11-01: deleting old tests waits for coverage.** Was "Old unit tests on shallow modules become waste once tests at the deepened module's interface exist; delete them." Why: read against `CLAUDE.md`'s "Never delete, skip or weaken a test", nothing said the new tests must cover the same behaviour first. Owner's call (doc-audit).
