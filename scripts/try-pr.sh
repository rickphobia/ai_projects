#!/usr/bin/env bash
# Builds a PR's web version on this machine and serves it, so you can try it before merging. For
# PRs whose build is too big for a `▶ Try this version` Artifact link (my-piggy's engine is ~40 MB).
#
# Browsers only run a Godot web build from HTTPS or localhost. When this machine has Tailscale with
# HTTPS certificates, the build is served at https://<machine>.<tailnet>.ts.net:<port>/ to your
# Tailscale devices (needs `sudo tailscale set --operator=$USER` once); otherwise only at
# http://localhost:<port>/.
#
# Usage: scripts/try-pr.sh <PR number> [--port N] [--keep]
#   --port N   port to serve on (default 8000)
#   --keep     keep the build folder after you stop the server (faster next time)
#   --projects print the projects it can build, one per line, and exit
#
# The PR is checked out in .claude/worktrees/try-pr-<N>-<port>, so no other checkout changes branch.
# Press Ctrl+C to stop; the folder is then removed unless --keep was given.
#
# Settings (environment variables, all optional):
#   TRY_PR_RSS_NEWS_PASSWORD  the password an rss-news preview signs in with (default "preview")
set -euo pipefail

# A preview-only password, not the real site's: a preview has a throwaway database and is reachable
# only from this machine and your Tailscale devices.
rss_news_password="${TRY_PR_RSS_NEWS_PASSWORD:-preview}"

die() {
  printf 'try-pr: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '6,10p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# The projects build_web knows. scripts/previews.sh reads this list through --projects.
web_projects=(ascii-sky happy-cotton my-piggy pawn-swarm rss-news)

# Builds the project in the current folder and prints the folder to serve. Each web project's
# build steps come from its README. $2 names the build ("PR #41 · 1ae5b74").
build_web() {
  case $1 in
    happy-cotton | my-piggy)
      printf '%s\n' "$2" >version.txt # shown on the title screen
      command -v godot >/dev/null || die "godot not found; run projects/$1/scripts/setup-godot.sh"
      godot --headless --import >&2
      mkdir -p build/web
      godot --headless --export-release Web build/web/index.html >&2
      echo build/web
      ;;
    ascii-sky)
      [ -f .env ] || cp .env.example .env
      npm ci >&2
      VITE_BUILD_VERSION="$2" npm run build >&2
      echo dist
      ;;
    pawn-swarm)
      npm ci >&2
      npm run build >&2
      echo dist
      ;;
    rss-news)
      uv sync --locked >&2
      (cd pwa && npm ci && npm run build) >&2
      echo pwa/dist
      ;;
    *) die "don't know how to build '$1'; add it to build_web and web_projects in $0" ;;
  esac
}

# Prints this machine's Tailscale HTTPS name (e.g. box.tailnet.ts.net), or nothing.
tailscale_https_host() {
  command -v tailscale >/dev/null || return 0
  tailscale status --json 2>/dev/null | jq -r '(.CertDomains // [])[0] // empty' || true
}

# Commands run on exit, whatever the reason (see the traps in main).
cleanup_steps=()
cleanup() {
  local step
  for step in "${cleanup_steps[@]}"; do eval "$step" || true; done
}

main() {
  local pr="" port=8000 keep=0
  while (($# > 0)); do
    case $1 in
      --port) port=${2:?--port needs a number}; shift ;;
      --keep) keep=1 ;;
      --projects) printf '%s\n' "${web_projects[@]}"; exit 0 ;;
      -h | --help) usage 0 ;;
      -*) die "unknown option $1 (see --help)" ;;
      *) [[ -z $pr && $1 =~ ^[0-9]+$ ]] || die "not a PR number: $1"; pr=$1 ;;
    esac
    shift
  done
  [[ -n $pr ]] || usage 1

  cd "$(git rev-parse --show-toplevel)"
  local -a projects
  mapfile -t projects < <(gh pr view "$pr" --json files --jq '.files[].path' |
    sed -n -E 's#^projects/([^/]+)/.*#\1#p' | sort -u)
  ((${#projects[@]} == 1)) || die "PR #$pr should change exactly one project, it changes: ${projects[*]:-none}"
  local project=${projects[0]}

  git fetch -q origin "pull/$pr/head" || die "could not fetch PR #$pr"
  local sha worktree=".claude/worktrees/try-pr-$pr-$port"
  sha=$(git rev-parse FETCH_HEAD)
  if [[ -d $worktree ]]; then
    git -C "$worktree" checkout -q --detach "$sha"
  else
    git worktree add -q --detach "$worktree" "$sha"
  fi
  trap cleanup EXIT
  # Turn Ctrl+C, a closed terminal or kill into a normal exit, so the EXIT trap always runs.
  trap 'exit 130' INT TERM HUP
  if ((!keep)); then
    cleanup_steps+=("cd $(printf %q "$PWD") && git worktree remove --force $worktree && echo 'Removed $worktree.'")
  fi

  printf 'Building PR #%s (%s, %s)…\n' "$pr" "$project" "$(git rev-parse --short "$sha")"
  cd "$worktree/projects/$project"
  local site
  site=$(build_web "$project" "PR #$pr · $(git rev-parse --short "$sha")")

  # The server listens on localhost only; Tailscale serves it over HTTPS on the same port number.
  local host url
  host=$(tailscale_https_host)
  if [[ -n $host ]] && tailscale serve --bg --https="$port" "http://localhost:$port" >/dev/null; then
    cleanup_steps+=("tailscale serve --https=$port off >/dev/null && echo 'Stopped HTTPS on port $port.'")
    url="https://$host:$port/ (from your Tailscale devices; on this machine also http://localhost:$port/)"
  else
    url="http://localhost:$port/ (this machine only: browsers block Godot over plain http from other devices)"
  fi
  printf '\nPR #%s is at %s. Ctrl+C to stop.\n' "$pr" "$url"
  serve_web "$project" "$site" "$port"
}

# Serves the built site on localhost:$3 until stopped. Projects with a backend run it instead of a
# static file server, with a throwaway database inside the PR's checkout.
serve_web() {
  case $1 in
    rss-news)
      local password_hash
      password_hash=$(printf '%s\n' "$rss_news_password" | uv run rss-news hash-password) ||
        die "could not hash the rss-news preview password"
      RSS_NEWS_PORT=$3 RSS_NEWS_PWA_DIR=$2 RSS_NEWS_DATABASE_PATH=data/try-pr.sqlite3 \
        RSS_NEWS_PASSWORD_HASH=$password_hash RSS_NEWS_SESSION_SECRET=$(openssl rand -hex 32) \
        uv run rss-news serve
      ;;
    *) python3 -m http.server --bind 127.0.0.1 --directory "$2" "$3" ;;
  esac
}

main "$@"
