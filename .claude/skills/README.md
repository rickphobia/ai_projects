# Skills

Project-wide skills for Claude Code. Every session in this repo, local or cloud, loads them.

## Source

All skills here except where noted are adapted from [mattpocock/skills](https://github.com/mattpocock/skills) at commit `d81f3a1` (2026-09-29), MIT licence — see `LICENSE-mattpocock-skills`. The `pr` skill also credits Dex Horthy (see `pr/CREDITS.md`).

The first commit that added them (`Vendor 11 skills from mattpocock/skills (unmodified)`) is the untouched copy, so `git diff` against it shows every change we made.

## What we changed

- Specs, tickets, glossary and decision records live inside each project (`projects/<name>/docs/...`, `projects/<name>/GLOSSARY.md`), not at the repo root or in GitHub Issues.
- Tickets are local files, not GitHub Issues: cloud sessions have no `gh` CLI, and files keep each project's work separate.
- `to-tickets` adds a **Touches** field (to know which tickets can run in parallel), makes ticket 01 of a new project a walking skeleton, caps a ticket at about 500 hand-written changed lines, keeps status to `ready`/`done`, adds **Effort** and **Owner steps** lines, and opens one PR for the spec and tickets on a `<name>/<feature>-spec` branch.
- `implement` follows this repo's `CLAUDE.md`: blockers check, project-prefixed commits, a staged-files check and full checks before commit, review, one PR per ticket, an Artifact preview link in the PR body, and watching PR events only for big changes. It covers local sessions on the Beelink too (worktrees, `gh pr checks --watch`, running the deploy script).
- `grilling` sends plain fact lookups to the `fact-finder` subagent (Haiku) and does lookups that need judgment itself, instead of starting general-purpose sub-agents.
- `tdd` counts the seams agreed in a spec as confirmed, so `/implement` sessions don't stop to ask again.
- `pr` adds a `Review:` line saying which review ran.
- `code-review` is renamed `review-diff` (Claude Code has a built-in `code-review`), reviews against `CLAUDE.md` and the ticket, and defaults to `main` as the fixed point.
- Upstream CAPS ("Do NOT", "COMPLETE") are plain wording in `to-spec` and `to-tickets`.
- `ADR` is renamed "decision record" in `docs/decisions/`, to match `CLAUDE.md`.
- `setup-matt-pocock-skills` is not included; the conventions above replace it.

## Updating from upstream

1. Clone mattpocock/skills and diff the skill against the commit above.
2. Apply the upstream changes by hand, keeping our changes.
3. Update the commit hash in this file.
