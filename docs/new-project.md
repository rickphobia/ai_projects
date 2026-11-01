# Starting a new project

Read this before creating a project or adding a top-level folder to one. The rules in the root `CLAUDE.md` apply on top.

## Layout

Every project uses the standard layout for its language, with these parts:

```
projects/<name>/
├── README.md          # from templates/project/README.md
├── .env.example       # every env var the project reads, with dummy values
├── .claude/
│   └── settings.json  # copy of the root .claude/settings.json (see below)
├── src/ (or the language's standard source folder)
│   ├── config         # loads and validates settings in one place
│   ├── <domain>/      # business logic, grouped by feature, not by file type
│   ├── adapters/      # code that talks to outside things: AI APIs, DBs, HTTP, files
│   └── entrypoint     # main / CLI / server startup — thin, just wires things together
├── tests/             # mirrors the src/ layout
├── GLOSSARY.md        # the project's own words and what they mean
├── docs/
│   ├── spec.md        # what we're building (from /to-spec)
│   ├── specs/         # specs for later features
│   ├── tickets/       # one file per ticket (from /to-tickets)
│   └── decisions/     # one short file per important design decision
└── dependency + tool config (pyproject.toml, package.json, etc.)
```

Web projects that go on the homelab also get `deploy/update-site.sh` and `deploy/rollback.sh`; copy the pattern from `projects/pawn-swarm/deploy/` and its README "Deploy" section. Also add the project to `web_projects` and `build_web` in `scripts/try-pr.sh`, or its PRs get no preview on the Beelink (see "Previews on the Beelink" in `docs/workflow.md`).

## Steps

This is ticket 01, the walking skeleton, done before any feature.

1. Create `projects/<name>/` (lowercase, hyphens) with the layout above.
2. Copy `templates/project/README.md` into it and fill it in.
3. Copy `.claude/settings.json` into `projects/<name>/.claude/settings.json`. Claude Code reads that file only from the folder a session starts in. Sessions normally start at the repo root; the copy guards a session someone starts inside the project folder. You may add project rules; CI (`.github/workflows/repo.yml`) fails if a root rule is missing.
4. Set up formatting, linting, type checks and a test runner before writing features.
5. Add `.env.example` and a config module.
6. Add `.github/workflows/<name>.yml` with `name: <name>`, scoped to `projects/<name>/**` with `paths:`. Copy an existing one. The file name must match the project folder: `ci-gate` uses it to know which workflow a PR must pass.
7. Add a row to the project index in the root `README.md`.
