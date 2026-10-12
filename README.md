# ai_slops

A home for the AI projects I build with Claude Code. Each project lives in its own folder and stands on its own.

Think of this repo as a bookshelf: every project is a separate book. Books sit side by side, but you can pull one off and read it without the others.

## Layout

```
ai_slops/
├── README.md            # this file: what the repo is and the project index
├── CLAUDE.md            # rules Claude Code follows when working here
├── .claude/skills/      # shared workflow skills: /grill-with-docs, /to-spec, /to-tickets, /implement ...
├── .claude/agents/      # fact-finder: cheap read-only lookups on Haiku, used by /grilling
├── .claude/settings.json  # guardrails (permission rules); each project keeps a copy
├── .github/             # one CI workflow per project, plus ci-gate (the check main requires)
├── scripts/             # next-tickets.sh: start ticket sessions; try-pr.sh / previews.sh: play PRs before merging
├── docs/                # how we work (workflow.md), new projects (new-project.md), tools (tooling.md)
├── projects/
│   └── <project-name>/  # one folder per project, fully self-contained
│       ├── README.md    # what it is, how to run it, current status
│       ├── docs/        # its spec, tickets and decision records
│       └── ...          # the project's own code, deps, config
└── templates/
    └── project/
        └── README.md    # starting point for a new project's README
```

## Rules

1. **One folder per project** under `projects/`. Use lowercase with hyphens: `projects/pdf-summarizer`.
2. **No sharing between projects.** A project never imports code from another project. If two need the same thing, copy it.
3. **Each project manages its own dependencies** (`package.json`, `requirements.txt`, etc.) inside its own folder. Nothing is installed at the repo root.
4. **Each project has a README** based on `templates/project/README.md`.
5. **Each project is built to company standards**: clear structure, tests, typed code, real logging, no hard-coded secrets. The full rules are in `CLAUDE.md`.
6. **Add the project to the index below** when you create it.

## Working on a project

Start Claude Code **inside the project folder**:

```bash
cd ai_slops/projects/my-project
claude
```

Claude Code loads every `CLAUDE.md` from the folder you start in up to the repo root. So it reads the shared rules in `ai_slops/CLAUDE.md` **and** the project's own `projects/my-project/CLAUDE.md` (if it has one). It also picks up that project's `.mcp.json`, so each project only gets its own tools.

The rules are shared; the code is not. Like a company handbook that every team follows, while each team keeps its own codebase.

In a cloud session (claude.ai/code) the session always starts at the repo root. Name the project in your first message, e.g. "work on `projects/my-project`".

Claude Code reads `.claude/settings.json` (the guardrails: no reading `.env`, ask before force-pushes and `rm -rf`) only from the folder you start in, so each project keeps a copy of the root one.

**Two local sessions at once** (on the Beelink) must not share a checkout, or they switch branches under each other. Start the second one from the repo root in its own worktree:

```bash
cd ~/homelab/code/ai_slops
claude -w pawn-swarm-16    # worktree in .claude/worktrees/pawn-swarm-16, on its own branch
```

**Or let a script start the tickets.** `scripts/next-tickets.sh <project>` finds every ticket that can start now (blockers done, nobody on it, no shared **Touches** area) and starts each as a background session in its own worktree. Answer them in `claude agents`. Details in [`docs/workflow.md`](docs/workflow.md#starting-tickets-with-scriptsnext-ticketssh).

## Further reading

- [`docs/workflow.md`](docs/workflow.md) — the spec → plan → build → verify → review → deploy loop we follow
- [`docs/new-project.md`](docs/new-project.md) — the layout every project uses and the steps to start one
- [`docs/tooling.md`](docs/tooling.md) — recommended skills and MCP servers by topic (game dev, Blender, ML, ...)

## Starting a new project

Follow [`docs/new-project.md`](docs/new-project.md). It is ticket 01 of the project (the walking skeleton): folder, README from the template, a copy of `.claude/settings.json`, checks, CI workflow, and a row in the index below.

## Project index

| Project | What it does | Stack | Status |
|---------|--------------|-------|--------|
| [pawn-swarm](projects/pawn-swarm) | Chess-board auto-battler where pawns are army and money | TypeScript, Vite, Canvas | working |
| [my-piggy](projects/my-piggy) | First-person horror game: a human head on a pig's body, hunted by family in one night | Godot 4 (GDScript), web export | in progress |
| [ricknotes](projects/ricknotes) | Android tablet app for writing on study PDFs with a pen, with ink saved beside each PDF | Kotlin, Jetpack Compose, Android | in progress |
| [court-booker](projects/court-booker) | Books a badminton court on Picktime at midnight when a date opens, for one Operator | Python, FastAPI, SQLite, Playwright, Docker | in progress |
| [happy-cotton](projects/happy-cotton) | Browser farm game in the style of Hay Day that satirises forced labour in Xinjiang's cotton fields | Godot 4 (GDScript), web export | in progress |
| [rss-news](projects/rss-news) | Personal news briefing: reads many feeds for one owner and writes a short Briefing on request | Python, FastAPI, SQLite, TypeScript PWA, Docker | in progress |
| [ascii-sky](projects/ascii-sky) | Browser flight simulator drawn entirely in printable ASCII, from the cockpit to the instruments | TypeScript, Vite, three.js | in progress |
| [duit-log](projects/duit-log) | Android money log that turns e-wallet payment notifications into sorted Income and Expenses, on the phone only | Kotlin, Jetpack Compose, SQLDelight, Android | in progress |

Status values: `idea`, `in progress`, `working`, `abandoned`.
