# History: ai_projects (repo root)

Why things in the root docs (`CLAUDE.md`, `README.md`, `docs/`) changed, and what they said before. Read it when you need the reason behind a rule or fact. Main files say what's true now.

## CLAUDE.md

### How to work here

- **2026-11-01: heading and lead-in made plain.** Was "## Your role: senior DevOps engineer, not an amateur vibe coder" followed by "Act like a senior engineer who will be paged at 3am if this breaks. In practice:". Why: current models don't need role framing; the bullets are the real rules and are unchanged. Owner's call (doc-audit).

### Hosting and how we work here

- **2026-11-01: "Every PR has a preview" cut to the rule plus a pointer.** Was: "…The session publishes an Artifact for it (`/implement` step 5). A build too big for an Artifact gets the "No Artifact preview" placeholder, and the Beelink preview timer (`scripts/previews.sh`, see "Previews on the Beelink" in `docs/workflow.md`) builds each green PR with `scripts/try-pr.sh`, writes its link into the PR body, and stops the preview and removes its worktree once the PR is merged or closed. … A new web project must be added to `scripts/try-pr.sh` to get previews." Why: the file loads every session and only PR-opening tasks need the detail, which lives in `/implement` step 5, `docs/workflow.md` ("Previews on the Beelink", now also saying the worktree is removed) and `docs/new-project.md`. It also implied the timer only acts on the placeholder; `scripts/previews.sh` replaces any `▶` line, Artifact link included, and the owner confirmed the Beelink link should win (doc-audit).

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

- **2026-11-01: "Keep `CLAUDE.md` short" merged into "Habits that prevent slop".** It was in both sections; its cost reason ("loaded into every session, so each extra line is paid for every time") moved with it.
