---
name: implement
description: "Implement one ticket (or a small spec) end to end: test-first, checked, reviewed, committed and opened as a PR."
disable-model-invocation: true
---

Implement the ticket or spec the user names, usually `projects/<name>/docs/tickets/<NN>-<slug>.md`. One ticket per session, per branch, per PR. Two small tickets of the same kind (e.g. two lists of new types) may share one session and PR when the user names both.

## Before starting

1. Read the ticket, the project's spec in `projects/<name>/docs/`, `projects/<name>/GLOSSARY.md`, and any `CLAUDE.md` in the project. The root `CLAUDE.md` rules apply throughout.
2. Check every ticket in **Blocked by** has status `done`. If any doesn't, stop and tell the user.
3. If the prompt names a branch (`scripts/next-tickets.sh` does), use it. In a fresh worktree whose branch has no commits of its own (`git log origin/main..HEAD` is empty), rename that branch instead of making a new one: `git fetch origin && git branch -m <name> && git merge --ff-only origin/main`. Don't create a second branch and delete the worktree's one: `git branch -D` stops the session for approval. If you aren't in such a worktree, create the named branch from `origin/main`. Otherwise work on the branch the session gave you (cloud sessions and `claude -w` worktrees come with one). If there isn't one, create `<project-name>/<NN>-<slug>` from `origin/main`. Don't switch branches in a checkout another local session may be using: on the Beelink, a parallel ticket runs in its own worktree (`claude -w <project>-<NN>`).

## Build

- Use /tdd at the seams agreed in the spec.
- Stay inside the areas the ticket's **Touches** lists. If the work needs to change another area, stop and tell the user: a parallel session may be working there.
- Run type checks and single test files regularly, using the commands in the project README. Run the full lint, type check and test suite at the end. All must pass before you commit.
- If the hand-written diff grows well past ~500 changed lines, stop and suggest splitting the ticket: nobody can review a 2,000-line PR properly.

## Finish

1. If the change is big (roughly 400+ changed lines, or it changes core rules), use /review-diff against `main` and fix what it finds. Otherwise re-read your own diff against the ticket instead: /review-diff starts two extra sessions and costs a lot of tokens. Don't chase judgement-call nits. Either way, note which review ran for the PR's `Review:` line.
2. Tick the acceptance criteria in the ticket file and set its status to `done`. Status is only `ready` or `done`. Steps only the owner can do (a run on the server, a GitHub setting) stay on the ticket's **Owner steps** line and are repeated in the PR body; they don't hold the status back.
3. Update the project README and `.env.example` if anything they describe changed.
4. Stage files by name and check `git diff --cached --stat`: only files the ticket needs, no build output, downloaded tools, archives or binaries you didn't make on purpose. Commit with the project prefix: `<project-name>: <imperative summary>`.
5. If the project has something to look at or play (a web page, a game), build it and publish the build as a private Artifact, with its asset files passed as supporting `files`. Put `▶ Try this version: <link>` as the PR body's second line, so the user can try it before merging. Republish to the same link after later pushes. If a file is over the 15 MB Artifact limit, write `▶ No Artifact preview (<file> is <size>): try it with scripts/try-pr.sh <PR number>` instead; for projects that `scripts/try-pr.sh` builds, the Beelink preview timer replaces that line with the preview's link once it is up. Skip this for projects with nothing visual.
6. Push and open a PR using /pr. Show the user the test output and the PR link.
7. Get the PR green and mergeable: fix merge conflicts by merging `main` in (never force-push) and fix failing CI, including the `ci-gate` check. Never merge it yourself: the user merges.
   - Local session: `gh pr checks <number> --watch --fail-fast` (one command that returns when CI finishes, not an event stream), and `gh pr view <number> --json mergeable` for conflicts. Once green and mergeable, tell the user and stop; they resume the session for review comments.
   - Cloud session, big change (the step 1 threshold): watch with `subscribe_pr_activity` until it is merged or closed, and answer review comments.
   - Cloud session, small change: don't subscribe, since every GitHub event is re-read for the rest of the session. Tell the user the PR is open and stop; they resume the session if CI fails or they leave comments.
8. Deploy, if the project has `deploy/update-site.sh` and the user says the PR is merged: a local session on the Beelink runs it, then checks the live URL with `curl -I` as the project README says. A cloud session can't reach the server, so it tells the user to run it.

Never weaken, skip or delete a test to make it pass. If you can't get it green, say what's failing.
