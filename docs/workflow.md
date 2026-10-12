# How we work with Claude Code

Distilled 2026-10-01 from Anthropic's [best practices](https://code.claude.com/docs/en/best-practices), Harper Reed's codegen workflow, and talks by Boris Cherny (creator of Claude Code), Matt Pocock, Dex Horthy and Andrej Karpathy. The skills are adapted from [mattpocock/skills](https://github.com/mattpocock/skills) and live in `.claude/skills/`.

Experienced engineers all land on the same loop: **spec → plan → build in small steps → verify → review → merge.** The difference between "vibe coding" and real engineering is that you stay responsible for the code — you read it.

## The loop

| # | Step | You type | What you get |
|---|------|----------|--------------|
| 1 | Start a session on `main`: in the cloud (claude.ai/code), or on the Beelink in `~/homelab/code/ai_slops` | "New project: `pdf-summarizer`" (or "work on `projects/pdf-summarizer`") | Claude knows which folder it owns |
| 2 | Describe it | What you want and what the finished product looks like | — |
| 3 | Get grilled | `/grill-with-docs` | Rounds of numbered questions, each with a recommended answer. Builds `GLOSSARY.md` and decision records as you go |
| 4 | Write the spec | `/to-spec` | `docs/spec.md`. **Read it.** |
| 5 | Split into tickets | `/to-tickets` | `docs/tickets/01-…md`, `02-…md`, each with **Blocked by** and **Touches**, plus which can run in parallel. You approve the breakdown |
| 6 | Build the skeleton | `scripts/next-tickets.sh <name>` (or a new session: `/implement projects/<name>/docs/tickets/01-…md`) | Project runs, one test passes, CI green. One PR |
| 7 | Build in parallel | `scripts/next-tickets.sh <name>`: one background session per ticket that can start now | One PR per ticket |
| 8 | Review and merge | Try the PR: its `▶ Try this version` link, or on the Beelink `pr-list` (every green PR is built and served automatically at `https://beelink-mini-s.taildfbd18.ts.net:<9000 + PR number>/` on your Tailscale devices; see "Previews on the Beelink"), skim the diff, check its `Review:` line, then merge. GitHub only allows it once `ci-gate` is green | Tickets marked `done` on `main` |
| 9 | Deploy | On the Beelink: `projects/<name>/deploy/update-site.sh`, or ask a local session to run it | Live at `rickphobia.com/ai-projects/<name>/` |
| 10 | Repeat 7–9 | Run `scripts/next-tickets.sh <name>` again after each merge | — |

New feature on an existing project: start again at step 2 — `/to-spec` writes `docs/specs/<feature>.md` and `/to-tickets` continues the numbering.

Bug: `/diagnosing-bugs`. It builds a failing check first, then fixes.

## Rules for parallel work

- Only run tickets in parallel when all their blockers are `done` **and** their **Touches** don't overlap. Two sessions editing the same area is like two painters on the same wall.
- Each parallel ticket gets its own fresh session, branch and PR. Two small tickets of the same kind can share one session to save its start-up cost.
- **On the Beelink, each parallel session needs its own worktree.** Cloud sessions each get their own clone; local sessions share `~/homelab/code/ai_slops` and would switch branches under each other. Start the extra ones from the repo root with `claude -w <project>-<NN>`: a worktree under `.claude/worktrees/`, on its own branch from `origin/main`, removed when you exit if it has nothing unsaved.
- Each ticket's session watches its own PR until it is green and mergeable: it fixes merge conflicts (by merging `main` in) and failing CI by itself, so a PR only waits on you once it is green. A cloud session keeps watching until merge and answers review comments; a local one runs `gh pr checks --watch`, tells you it is ready, and stops (reopen it with `claude --resume` to answer comments). You still review and merge.
- Merge one PR at a time; merging one can make the next conflict, and its session then fixes that.

## Starting tickets with `scripts/next-tickets.sh`

On the Beelink, from `~/homelab/code/ai_slops` (any branch):

```bash
scripts/next-tickets.sh my-piggy --dry-run   # show the plan, start nothing
scripts/next-tickets.sh my-piggy             # show the plan, ask, then start
scripts/next-tickets.sh my-piggy 04 05       # consider only these tickets
```

It reads the tickets from `origin/main` and starts a ticket when its status is `ready`, every ticket in **Blocked by** is `done`, nobody is working on it (no `<project>/<NN>-…` branch, no open PR, no running session named `<project>-<NN>`), and none of its **Touches** areas is taken by a running or starting ticket. Each one runs as `claude --bg` with Opus 5.5 in auto permission mode, at the ticket's **Effort** (default: medium for 01, low otherwise), and moves into its own worktree before it edits anything.

**Answering them.** Run `claude agents` (agent view). A session that needs you is under **Needs input** with the question or permission prompt on its row: press `Space` to reply in place, or `Enter` to open the full session. While agent view is open, Claude Code sends a terminal notification when a session needs input, finishes or fails; in any other session the footer shows `← N agents` waiting. Sessions stop and wait for the guardrail prompts (force-push, `rm -rf` …) and for questions `/implement` asks.

**Cost.** A background session costs the same as opening a new session by hand: same model, same prompt caching, same start-up read of `CLAUDE.md` and the ticket. Running three at once spends the same tokens sooner; it doesn't add any. Two things do add cost: a session left waiting for more than an hour loses its cache, so answer within the hour; and auto mode's safety check on risky actions uses a little extra.

## Previews on the Beelink

my-piggy's build is too big for a `▶ Try this version` link, so the Beelink serves every PR itself. `scripts/previews.sh install` (once) starts a systemd user timer that, every minute, builds each open PR whose `ci-gate` is green and serves it at `https://beelink-mini-s.taildfbd18.ts.net:<9000 + PR number>/` (PR 41 → port 9041). Browsers only run a Godot build over HTTPS or on localhost, so it goes through Tailscale HTTPS: open it on a device signed in to your tailnet. Setup once: `sudo tailscale set --operator=$USER`, so the scripts can add the HTTPS ports without sudo. Without that, a preview only opens on the Beelink itself (`http://localhost:<port>/`). Once a preview answers (usually within a minute of `ci-gate` going green), the timer writes its link into the PR body as the `▶ Try this version:` line (replacing the session's "No Artifact preview" placeholder), so the link is on the PR itself. A new push is rebuilt once it is green; a merged or closed PR's preview stops. It runs only scripts, no Claude, so it costs no tokens.

```bash
scripts/previews.sh list     # open PRs, ci-gate result, preview link (shell function: pr-list)
scripts/previews.sh stop 41  # stop PR 41's preview until its next push (shell function: stop-pr 41)
scripts/try-pr.sh 41         # build and serve one PR by hand on port 8000, Ctrl+C to stop
```

A failed build shows in `list` with its log command (`journalctl --user -u try-pr-41`). `scripts/previews.sh uninstall` turns it all off. The timer runs while your user is logged in on the Beelink; to keep it running with nobody logged in, run `sudo loginctl enable-linger $USER` once.

## What protects `main`

You won't read every line of a 2,000-line PR, so automation carries most of the checking:

- **`ci-gate`** is the one required check. It waits for every other workflow run on the PR's head commit and fails if any fails, or if a changed project's workflow never ran. It reports once: if you re-run a failed workflow by hand, re-run `ci-gate` after it.
- **Ticket size.** `/to-tickets` aims for about 500 hand-written changed lines per ticket, so a PR can be skimmed.
- **Review line.** Every PR body says which review ran: `/review-diff` for big or core-rule changes, a self-review for small ones.
- **Guardrails.** `.claude/settings.json` (copied into each project, because a session reads it only from the folder it starts in) blocks reading `.env` files and asks before force-pushes, `git reset --hard`, `git clean -f`, `git branch -D` and `rm -rf`.

## Keeping token use down

Each step in a session re-reads everything the session has seen so far, so long sessions get expensive fast.

- **Opus 5.5 for everything; pick the effort, not the model.** Opus costs twice Sonnet per token but needs fewer tokens per task, so per finished task it is as cheap or cheaper at the same quality (Artificial Analysis, 2026-10: Opus low 42 points for $0.55 vs Sonnet medium 41 for $0.59; Opus medium 51 for $1.34 vs Sonnet high 47 for $1.08). Use **medium** for grilling, `/to-spec`, `/to-tickets` and hard tickets (walking skeletons, tricky logic), **low** for small tickets. If a low ticket needs more than one fix round, move it to medium. Avoid high and above unless a ticket keeps failing: cost climbs fast for little gain. Re-check when new models ship.
- **The one exception: plain lookups go to Haiku 5.5.** The `fact-finder` subagent (`.claude/agents/fact-finder.md`, read-only, low effort) answers questions like "where is X used" or "what does the tuning file say" at about 1/40 of Opus's price per token ($0.10/$0.50 vs $4/$20 per million). It got six happy-cotton lookups right in a 2026-10-08 test, about 1 cent for 63k tokens. Haiku isn't careful enough for anything important, so it never reviews, designs, debugs or makes a judgment call: those stay on Opus. `/grilling` uses it for its fact lookups.
- **Keep the saved default at medium.** `/effort <level>` is saved as the default for every new session, so raising it for one hard task raises it for all of them. Set it back with `/effort medium` when that task is done.
- **Keep sessions short.** Start a fresh session when the topic changes or the old one has run all day. Ticket files hold the status (`ready` / `done`), so nothing is lost. The planning session ends once the tickets are committed; changes to the workflow itself get their own short session.
- **Watch a PR only when it matters.** Every GitHub event adds a few thousand tokens that are re-read for the rest of the session. For a small change, skip the watching and check CI yourself. The planning session never watches PRs; a second watcher doubles the cost.
- **Batch small changes.** Collect small fixes (a rename, a doc line) into one session instead of one session each.
- **`/review-diff` only for big tickets** (see `/implement`). It starts two extra sessions.
- **No agents or multi-agent workflows in parallel** unless the owner asks. Each one has its own full cost.
- **Keep `CLAUDE.md` short.** It is loaded into every session, so each extra line is paid for every time.
- **Check where the money goes** on the account usage page (cost per session and model) before guessing.

## Habits that prevent slop

- **Read the code, not just the plan.** Dex Horthy's team stopped reading code for six months and had to rip out large parts.
- **Fresh session per ticket.** Quality drops once the context is ~40% full. After two failed corrections, `/clear` and restate the problem instead of arguing.
- **Keep CLAUDE.md short.** For each line ask "would Claude make a mistake without this?" Add a line each time Claude gets something wrong; prune after model upgrades.
- **Turn hard rules into settings.** CLAUDE.md is advice; permission rules in `.claude/settings.json` always apply (see "What protects `main`"). Format and lint run in CI and before every commit. Reach for a hook only when a rule needs logic a permission pattern can't express.
- **Guard the tests.** Agents have been caught mocking, editing or hard-coding tests to go green. `/review-diff` checks the diff against the ticket.
- **Give it the docs.** Paste URLs or use Context7 so it doesn't invent APIs.
- **Security for anything deployed:** no API keys in frontend code, database access rules switched on. These are the most common holes in AI-built apps.

## Skills reference

| Skill | Use it to |
|-------|-----------|
| `/grill-with-docs` | Get interviewed about an idea; records glossary terms and decisions |
| `/grilling` | Same interview, without writing docs |
| `/to-spec` | Turn the conversation into a spec file |
| `/to-tickets` | Turn a spec into ticket files with blockers and parallel batches |
| `/implement` | Build one ticket end to end, open a PR and keep it green until you merge |
| `/tdd` | Test-first loop (used by `/implement`) |
| `/review-diff` | Review a diff against `CLAUDE.md` and the ticket |
| `/pr` | Write a PR description with evidence and risk |
| `/diagnosing-bugs` | Debug with a failing check first |
| `codebase-design`, `domain-modeling` | Reference vocabulary the other skills load |
