#!/usr/bin/env bash
# Keeps a preview of every open PR running on this machine, ready to try before merging: once a
# PR's ci-gate is green, its build is served at https://<machine>.<tailnet>.ts.net:<9000 + PR>/
# to your Tailscale devices (see scripts/try-pr.sh), and that link is written into the PR body's
# `▶ Try this version:` line. A new push gets a fresh build once it is green again; a merged or
# closed PR's preview is stopped.
# Each preview is a systemd user service, try-pr-<N>, running scripts/try-pr.sh. No Claude.
#
# Usage: scripts/previews.sh <command>
#   install    copy the scripts to ~/.local/state/ai-slops-previews and run `sync` every minute
#   uninstall  stop the timer and every preview
#   sync       start, refresh and stop previews to match the open PRs (what the timer runs)
#   list       open PRs with their ci-gate result and preview link
#   stop N     stop PR N's preview until its next push
#
# Settings (environment variables, all optional):
#   PREVIEWS_REPO   the ai_slops checkout to work from (default ~/homelab/code/ai_slops)
set -euo pipefail

repo="${PREVIEWS_REPO:-$HOME/homelab/code/ai_slops}"
state="$HOME/.local/state/ai-slops-previews"
units="$HOME/.config/systemd/user"
timer=ai-slops-previews
# How long a sync waits for a preview it just started to answer before writing its link. A Godot
# build takes about 15 seconds; a preview still building after this gets its link on a later sync.
link_wait_seconds=120
poll_seconds=2
# Shells started outside a desktop session (ssh, cron) may not set it; systemctl --user needs it.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

die() {
  printf 'previews: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '9,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

ctl() { systemctl --user "$@"; }
port_of() { echo $((9000 + $1)); }
unit_state() { ctl show -p ActiveState --value "try-pr-$1.service"; }
# The commit a preview was started for, kept in its description ("try-pr <N> <sha>").
unit_sha() { ctl show -p Description --value "try-pr-$1.service" | awk '$1 == "try-pr" {print $3}'; }
stopped_sha() { cat "$state/stopped-$1" 2>/dev/null || true; }
preview_numbers() {
  ctl list-units --all --plain --no-legend 'try-pr-*.service' | sed -n -E 's/^try-pr-([0-9]+)\.service.*/\1/p'
}

# This machine's Tailscale HTTPS name (e.g. box.tailnet.ts.net), or nothing.
preview_host() {
  tailscale status --json 2>/dev/null | jq -r '(.CertDomains // [])[0] // empty' || true
}

# Reads a PR body on stdin and prints it with `▶ Try this version: <url>` as its preview line: it
# replaces the first line starting with "▶ " (the session's placeholder or an older link), or goes
# after a first "Ticket:" line, or at the top.
body_with_link() { # body_with_link <url>
  awk -v link="▶ Try this version: $1" '
    { lines[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) if (index(lines[i], "▶ ") == 1) { lines[i] = link; replaced = 1; break }
      start = 1
      if (!replaced) {
        if (NR >= 1 && index(lines[1], "Ticket: ") == 1) { print lines[1]; start = 2 }
        print link
        if (start == 1) print ""
      }
      for (i = start; i <= NR; i++) print lines[i]
    }'
}

# Puts the preview link in PR N's body, unless it is already there.
link_preview() { # link_preview <N> <url>
  local body
  body=$(gh pr view "$1" --json body --jq .body)
  [[ $body == *"▶ Try this version: $2"* ]] && return 0
  # The REST API, not `gh pr edit`: Ubuntu's gh 2.45 asks GraphQL for classic project cards on
  # every edit, and GitHub now rejects that, so the edit always failed.
  if body_with_link "$2" <<<"$body" | gh api -X PATCH "repos/{owner}/{repo}/pulls/$1" -F body=@- >/dev/null; then
    echo "PR #$1: preview link added to the PR body"
  else
    echo "PR #$1: could not add the preview link to the PR body" >&2
  fi
}

# Waits up to <seconds> for PR N's preview to answer; fails if it doesn't, or stops running.
wait_for_preview() { # wait_for_preview <N> <seconds>
  local deadline=$((SECONDS + $2))
  until curl -s -o /dev/null --max-time 2 "http://localhost:$(port_of "$1")/"; do
    [[ $(unit_state "$1") =~ ^(active|activating)$ ]] && ((SECONDS < deadline)) || return 1
    sleep "$poll_seconds"
  done
}

stop_unit() {
  ctl stop "try-pr-$1.service" 2>/dev/null || true
  ctl reset-failed "try-pr-$1.service" 2>/dev/null || true
}

# Prints "N<TAB>head sha<TAB>ci-gate result<TAB>project or -<TAB>title" for every open PR.
open_prs() {
  gh pr list --state open --limit 100 --json number,title,headRefOid,statusCheckRollup,files --jq '
    .[] | [
      .number,
      .headRefOid,
      ([.statusCheckRollup[]? | select(.name == "ci-gate")] | last | (.conclusion // .status // "none")),
      ([.files[].path | capture("^projects/(?<p>[^/]+)/").p] | unique | if length == 1 then .[0] else "-" end),
      .title
    ] | @tsv'
}

# Copies main's versions of the scripts into the state folder, so the timer runs the latest ones.
# A rename keeps a running preview on the copy it started with.
refresh_scripts() {
  git fetch -q origin main
  git cat-file -e origin/main:scripts/previews.sh 2>/dev/null || return 0
  local file
  for file in previews.sh try-pr.sh; do
    git show "origin/main:scripts/$file" >"$state/$file.new"
    chmod +x "$state/$file.new"
    mv "$state/$file.new" "$state/$file"
  done
}

start_preview() { # start_preview <N> <sha>
  stop_unit "$1"
  rm -f "$state/stopped-$1"
  echo "PR #$1: building ${2:0:7} for port $(port_of "$1")"
  # try-pr.sh exits 130 when stopped; count that as a clean stop, not a failed build, or sync
  # would skip this commit as failed.
  systemd-run --user --quiet --unit "try-pr-$1" --description "try-pr $1 $2" \
    --working-directory "$repo" --setenv "PATH=$PATH" --property "SuccessExitStatus=130" \
    "$state/try-pr.sh" "$1" --port "$(port_of "$1")"
}

cmd_sync() {
  cd "$repo"
  refresh_scripts
  local -a web
  mapfile -t web < <("$state/try-pr.sh" --projects)
  local -A open=() started=()
  local -a prs
  mapfile -t prs < <(open_prs)
  local n sha gate project title state_now row host
  for row in "${prs[@]}"; do
    IFS=$'\t' read -r n sha gate project title <<<"$row"
    open[$n]=1
    [[ $gate == SUCCESS && " ${web[*]} " == *" $project "* ]] || continue
    [[ $(stopped_sha "$n") == "$sha" ]] && continue
    state_now=$(unit_state "$n")
    if [[ $(unit_sha "$n") == "$sha" && $state_now =~ ^(active|activating|failed)$ ]]; then
      continue
    fi
    start_preview "$n" "$sha"
    started[$n]=1
  done

  # A preview built for the PR's latest push and answering gets its link into the PR body. One
  # started by this sync is waited for, so its link lands now rather than on the next sync.
  host=$(preview_host)
  if [[ -n $host ]]; then
    for row in "${prs[@]}"; do
      IFS=$'\t' read -r n sha gate project title <<<"$row"
      [[ $(unit_state "$n") == active && $(unit_sha "$n") == "$sha" ]] || continue
      wait_for_preview "$n" "$([[ -n ${started[$n]:-} ]] && echo "$link_wait_seconds" || echo 0)" ||
        continue
      link_preview "$n" "https://$host:$(port_of "$n")/"
    done
  fi

  for n in $(preview_numbers); do
    if [[ -z ${open[$n]:-} ]]; then
      echo "PR #$n: closed, stopping its preview"
      stop_unit "$n"
      rm -f "$state/stopped-$n"
    fi
  done
}

cmd_list() {
  cd "$repo"
  local host n sha gate project title port preview
  host=$(preview_host)
  local -a web
  mapfile -t web < <("$state/try-pr.sh" --projects 2>/dev/null || true)
  while IFS=$'\t' read -r n sha gate project title; do
    port=$(port_of "$n")
    case $(unit_state "$n") in
      active | activating)
        if curl -s -o /dev/null --max-time 2 "http://localhost:$port/"; then
          if [[ -n $host ]]; then preview="https://$host:$port/"; else preview="http://localhost:$port/"; fi
          [[ $(unit_sha "$n") == "$sha" ]] || preview+="  (an older push; the new one builds once ci-gate passes)"
        else
          preview="building… (log: journalctl --user -u try-pr-$n)"
        fi
        ;;
      failed) preview="build failed: journalctl --user -u try-pr-$n" ;;
      *)
        if [[ " ${web[*]} " != *" $project "* ]]; then
          preview="none (nothing to build for '$project')"
        elif [[ $(stopped_sha "$n") == "$sha" ]]; then
          preview="stopped; starts again after the next push"
        elif [[ $gate != SUCCESS ]]; then
          preview="starts once ci-gate passes"
        else
          preview="starts within a minute"
        fi
        ;;
    esac
    printf '#%-4s %-8s %s\n      %s\n' "$n" "${gate,,}" "$title" "$preview"
  done < <(open_prs)
  ctl is-active -q "$timer.timer" || echo "(the timer is off: scripts/previews.sh install)"
}

cmd_stop() {
  local n=${1:?stop needs a PR number}
  [[ $n =~ ^[0-9]+$ ]] || die "not a PR number: $n"
  cd "$repo"
  stop_unit "$n"
  mkdir -p "$state"
  gh pr view "$n" --json headRefOid --jq .headRefOid >"$state/stopped-$n"
  echo "Stopped PR #$n's preview. It starts again after the PR's next push."
}

cmd_install() {
  local source_dir
  source_dir=$(cd "$(dirname "$0")" && pwd)
  mkdir -p "$state" "$units"
  if [[ $source_dir != "$state" ]]; then
    install -m 755 "$source_dir/previews.sh" "$source_dir/try-pr.sh" "$state/"
  fi
  # The timer runs without a login shell, so it gets this shell's PATH (node, godot, gh).
  cat >"$units/$timer.service" <<EOF
[Unit]
Description=Start, refresh and stop ai_slops PR previews

[Service]
Type=oneshot
Environment=PATH=$PATH
Environment=PREVIEWS_REPO=$repo
ExecStart=$state/previews.sh sync
EOF
  cat >"$units/$timer.timer" <<EOF
[Unit]
Description=Sync ai_slops PR previews every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
# systemd otherwise delays a timer by up to a minute to batch wakeups.
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF
  ctl daemon-reload
  ctl enable --now "$timer.timer"
  ctl start "$timer.service"
  echo "Installed. Previews sync every minute; see them with: scripts/previews.sh list"
}

cmd_uninstall() {
  ctl disable --now "$timer.timer" 2>/dev/null || true
  local n
  for n in $(preview_numbers); do stop_unit "$n"; done
  rm -f "$units/$timer.service" "$units/$timer.timer"
  ctl daemon-reload
  rm -rf "$state"
  echo "Uninstalled: timer off, previews stopped."
}

main() {
  case ${1:-} in
    install) cmd_install ;;
    uninstall) cmd_uninstall ;;
    sync) cmd_sync ;;
    list) cmd_list ;;
    stop) cmd_stop "${2:-}" ;;
    -h | --help) usage 0 ;;
    *) usage 1 ;;
  esac
}

# Sourced by scripts/tests/previews.test.sh to test the functions without running a command.
[[ ${BASH_SOURCE[0]} != "$0" ]] || main "$@"
