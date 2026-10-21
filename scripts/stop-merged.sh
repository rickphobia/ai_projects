#!/usr/bin/env bash
# Stops the background ticket sessions (started by next-tickets.sh as `<project>-<NN>`) whose PR
# is merged. A finished session sits idle holding 200-400 MB of RAM until it exits; stopping it
# frees that and keeps its conversation (`claude attach <id>` or `claude --resume` reopens it).
#
# Usage: scripts/stop-merged.sh [project] [--dry-run]
#   project     only this project's sessions (default: every project)
#   --dry-run   print what would be stopped, stop nothing
#
# A session's PR is the one on a `<project>/<NN>-…` branch. A session that is still working, or
# whose ticket also has an open PR, is left alone.
set -euo pipefail

die() {
  printf 'stop-merged: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '6,8p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

main() {
  local project="" dry_run=0
  while (($# > 0)); do
    case $1 in
      --dry-run) dry_run=1 ;;
      -h | --help) usage 0 ;;
      -*) die "unknown option $1 (see --help)" ;;
      *) [[ -z $project ]] || die "only one project allowed"; project=$1 ;;
    esac
    shift
  done
  command -v claude >/dev/null || die "claude is not installed"
  command -v gh >/dev/null || die "gh is not installed"

  local sessions merged open
  sessions="$(claude agents --json | jq -r '.[] | select(.kind == "background") |
    [.id, (.name // ""), (.state // "")] | @tsv')" || die "could not list sessions (claude agents --json)"
  merged="$(gh pr list --state merged --limit 200 --json number,headRefName \
    --jq '.[] | "\(.headRefName)\t\(.number)"')" || die "could not list merged PRs (gh pr list)"
  open="$(gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName')" ||
    die "could not list open PRs (gh pr list)"

  local id name state prefix pr stopped=0
  while IFS=$'\t' read -r id name state; do
    [[ $name =~ ^(.+)-([0-9]{2})$ ]] || continue
    [[ -z $project || ${BASH_REMATCH[1]} == "$project" ]] || continue
    prefix="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}-"
    pr="$(awk -F'\t' -v p="$prefix" 'index($1, p) == 1 { print $2; exit }' <<<"$merged")"
    [[ -n $pr ]] || continue
    if grep -q "^$prefix" <<<"$open"; then
      printf '  %-28s kept: PR #%s is merged but another PR on %s… is open\n' "$name" "$pr" "$prefix"
    elif [[ $state == working ]]; then
      printf '  %-28s kept: PR #%s is merged but the session is still working\n' "$name" "$pr"
    elif ((dry_run)); then
      printf '  %-28s would stop (PR #%s merged)\n' "$name" "$pr"
    else
      claude stop "$id" >/dev/null || die "could not stop $name ($id)"
      printf '  %-28s stopped (PR #%s merged; reopen with: claude attach %s)\n' "$name" "$pr" "$id"
      stopped=$((stopped + 1))
    fi
  done <<<"$sessions"

  if ((dry_run)); then echo "Dry run: nothing stopped."; else echo "Stopped $stopped session(s)."; fi
}

main "$@"
