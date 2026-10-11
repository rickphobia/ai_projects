# Tooling: skills, plugins and MCP servers

Researched 2026-10-01 from GitHub and official docs. Reddit and YouTube were blocked from the research environment, so community opinion comes from Hacker News, blogs and talk transcripts. Star counts are approximate.

**Rule of thumb: install the fewest tools that do the job, per project.** Every skill and MCP server costs context. One test of 47 marketplace skills found most made output worse. Add tools at project scope (`projects/<name>/.mcp.json`), not repo-wide, unless every project needs them.

**Desktop vs cloud:** tools marked 🖥️ connect to a running desktop app (Blender, Unity, Unreal, Godot editor). They only work when Claude Code runs on your own machine, not in a claude.ai/code cloud session.

## Every project

| Tool | What it does | Install |
|------|--------------|---------|
| [Context7](https://github.com/upstash/context7) | Feeds Claude current, version-correct library docs. Stops invented APIs. | `claude mcp add --transport http context7 https://mcp.context7.com/mcp` |
| Official `code-review` / `pr-review-toolkit` plugins | Multi-agent review of a diff or PR | `/plugin install code-review@claude-plugins-official` |
| Official LSP plugin for the language (`pyright-lsp`, `typescript-lsp`, ...) | Real go-to-definition and type errors | `/plugin install pyright-lsp@claude-plugins-official` |
| `security-guidance` plugin | Warns on risky edits | `/plugin install security-guidance@claude-plugins-official` |
| [mattpocock/skills](https://github.com/mattpocock/skills) — **already in `.claude/skills/`**, adapted to this repo | Grill → spec → tickets → TDD → review workflow | Nothing to install. Don't also add Superpowers: two workflow packs fight each other |

Optional: [Playwright MCP](https://github.com/microsoft/playwright-mcp) for web UIs, [GitHub MCP](https://github.com/github/github-mcp-server) with `--toolsets` limited.

Skipped: Sequential Thinking (built-in thinking covers it), Serena (its own docs report Claude Code ignoring its tools), big mixed marketplaces (context bloat).

## Game dev

| Tool | What it does | Notes |
|------|--------------|-------|
| [Godot AI](https://github.com/hi-godot/godot-ai) 🖥️ | 46 tools inside the Godot 4.7+ editor | Editor plugin generates the `claude mcp add` command |
| [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) | Run projects, read debug output, edit scenes | Works headless — usable in the cloud if Godot is installed |
| [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) 🖥️ | Unity scenes, assets, C# with validation | Largest Unity community |
| Epic's built-in Unreal MCP (UE 5.8) 🖥️ | First-party, experimental | No documented auth |
| [ChiR24/Unreal_mcp](https://github.com/ChiR24/Unreal_mcp) 🖥️ | Mature third-party Unreal option, UE 5.0–5.8 | Token-gated |

## Blender / 3D

| Tool | What it does | Notes |
|------|--------------|-------|
| [MCP for Blender](https://github.com/ahujasid/mcp-for-blender) 🖥️ | Control Blender, fetch Poly Haven/Sketchfab assets | ~30k stars. ⚠️ Runs **unsandboxed Python** with full disk/network access. Set `DISABLE_TELEMETRY=true`. |
| [blenderwright](https://github.com/HoldMyBeer-gg/blenderwright) 🖥️ | 186 tools, sandboxed Python | Safer, smaller community |

## Game assets (all cloud, paid API keys)

| Tool | What it does | Install |
|------|--------------|---------|
| [fal MCP](https://fal.ai/docs/documentation/setting-up/mcp) | 1,000+ models: images, sprites, textures, audio, 3D | `claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"` |
| [ElevenLabs MCP](https://elevenlabs.io/docs/eleven-agents/operate/hosted-mcp) | Voice, sound effects, music | `claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp` (the old local repo is archived) |
| [pixel-plugin](https://github.com/willibrandon/pixel-plugin) | Pixel art via Aseprite | Needs Aseprite installed |

## Machine learning and data

| Tool | What it does | Install |
|------|--------------|---------|
| [Hugging Face MCP](https://github.com/huggingface/hf-mcp-server) + [HF skills](https://github.com/huggingface/skills) | Search models/datasets/papers, run Spaces, fine-tuning skills | `claude mcp add hf -t http "https://huggingface.co/mcp?login"`; `/plugin marketplace add huggingface/skills` |
| [Jupyter MCP](https://github.com/datalayer/jupyter-mcp-server) | Run code in a live notebook kernel and read outputs | Only if you need a live kernel; Claude can already edit `.ipynb` files |
| [W&B MCP](https://github.com/wandb/wandb-mcp-server) **or** MLflow's `mlflow mcp run` | Query experiment runs and metrics | Whichever tracker the project uses |
| [DuckDB/MotherDuck MCP](https://github.com/motherduckdb/mcp-server-motherduck) | SQL over local files, read-only by default | `uvx mcp-server-motherduck` |
| [arXiv MCP](https://github.com/blazickjp/arxiv-mcp-server) | Search and read papers, no key | `claude mcp add arxiv -- uvx arxiv-mcp-server` |
| Kaggle official hosted MCP | Datasets, competitions, notebooks | Docs at kaggle.com/docs/mcp (not verified) |

No official Modal MCP exists; use the Modal skills in [AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-Research-SKILLs) if needed.

## Reverse engineering

Only for a project whose job is to inspect software we don't have the source for. Analyse only software you are allowed to (many EULAs forbid it).

| Tool | What it does | Install |
|------|--------------|---------|
| [REA](https://github.com/morluto/rea) | Inspects native binaries (via Hopper, Ghidra or IDA), Electron/JS apps, APKs, .NET assemblies, firmware, websites and HAR captures | `claude mcp add --scope project rea -- npx -y rea-agents@6.4.0 mcp` (checked 2026-10-11; bump the pin on purpose) |

⚠️ Don't run `npx rea-agents setup`: it writes user-level config and installs its own workflow skill, which competes with ours. Prefer the static analyzers (JS, APK, .NET), which read files without running them. Runtime capture executes the target as your user, so don't run it on the Beelink, which also serves the site. Use a container or a cloud session instead.

## Sharing config through the repo

- **MCP servers:** `claude mcp add --scope project ...` writes `.mcp.json`. Commit it. Put secrets in env vars as `${VAR}`, never in the file.
- **Skills:** `.claude/skills/<name>/SKILL.md`, committed. Works per project folder too.
- **Plugins:** `enabledPlugins` in `.claude/settings.json`. ⚠️ Cloud sessions (claude.ai/code) do **not** load plugins from this file; `.mcp.json` and `.claude/skills/` do work there.

Docs: [MCP](https://code.claude.com/docs/en/mcp) · [Skills](https://code.claude.com/docs/en/skills) · [Plugins](https://code.claude.com/docs/en/discover-plugins)
