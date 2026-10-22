#!/usr/bin/env bash
# Runs what a merged ticket PR calls for, every 5 minutes on the Beelink, so nobody has to say
# "merged": stop-merged.sh stops finished ticket sessions (every project), then next-tickets.sh
# --yes starts the next unblocked tickets of each project that is switched on. No Claude: a
# systemd user timer runs the scripts, and only the ticket sessions it starts cost tokens.
#
# Usage: scripts/after-merge.sh <command>
#   install       copy the scripts to ~/.local/state/ai-projects-after-merge, run every 5 minutes
#   uninstall     stop the timer and remove it
#   on <project>  start this project's tickets after merges (stopping happens for every project)
#   off <project> stop starting this project's tickets
#   status        the timer, the switched-on projects, and how to see the log
#   run           one pass now (what the timer runs)
#
# Settings (environment variables, all optional):
#   AFTER_MERGE_REPO     the ai_projects checkout to work from (default ~/homelab/code/ai_projects)
#   AFTER_MERGE_STATE    where the switched-on list and script copies live (default above)
#   AFTER_MERGE_SCRIPTS  run stop-merged.sh and next-tickets.sh from this folder instead of
#                        main's latest versions (for tests)
set -euo pipefail

repo="${AFTER_MERGE_REPO:-$HOME/homelab/code/ai_projects}"
state="${AFTER_MERGE_STATE:-$HOME/.local/state/ai-projects-after-merge}"
units="$HOME/.config/systemd/user"
timer=ai-projects-after-merge
projects_file="$state/projects"
# Shells started outside a desktop session (ssh, cron) may not set it; systemctl --user needs it.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

die() {
  printf 'after-merge: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '7,13p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

ctl() { systemctl --user "$@"; }

switched_on() {
  [[ -f $projects_file ]] && grep -v '^\s*$' "$projects_file" || true
}

# The folder holding the stop-merged.sh and next-tickets.sh to run: main's latest versions, so
# the repo checkout (which nobody pulls) can't run stale ones.
scripts_dir() {
  if [[ -n ${AFTER_MERGE_SCRIPTS:-} ]]; then
    echo "$AFTER_MERGE_SCRIPTS"
    return
  fi
  git -C "$repo" fetch -q origin main
  local file
  mkdir -p "$state/scripts"
  for file in stop-merged.sh next-tickets.sh; do
    git -C "$repo" show "origin/main:scripts/$file" >"$state/scripts/$file.new"
    chmod +x "$state/scripts/$file.new"
    mv "$state/scripts/$file.new" "$state/scripts/$file"
  done
  echo "$state/scripts"
}

cmd_run() {
  mkdir -p "$state"
  # A slow pass (fetches, gh) must not overlap the next one and start the same ticket twice.
  exec 9>"$state/lock"
  flock -n 9 || { echo "another pass is still running"; return 0; }
  cd "$repo"
  local dir failed=0 project
  dir="$(scripts_dir)"
  "$dir/stop-merged.sh" || { echo "stop-merged.sh failed"; failed=1; }
  while read -r project; do
    "$dir/next-tickets.sh" "$project" --yes || { echo "next-tickets.sh $project failed"; failed=1; }
  done < <(switched_on)
  return "$failed"
}

cmd_on() {
  [[ -n ${1:-} ]] || usage 1
  [[ -d $repo/projects/$1 ]] || die "no project $1 in $repo/projects"
  mkdir -p "$state"
  if switched_on | grep -qx "$1"; then
    echo "$1 is already on."
  else
    echo "$1" >>"$projects_file"
    echo "On: $1's next tickets start after merges."
  fi
}

cmd_off() {
  [[ -n ${1:-} ]] || usage 1
  local rest
  rest="$(switched_on | grep -vx "$1" || true)"
  printf '%s' "${rest:+$rest$'\n'}" >"$projects_file"
  echo "Off: $1's tickets no longer start by themselves (its merged sessions are still stopped)."
}

cmd_status() {
  if ctl is-active -q "$timer.timer" 2>/dev/null; then
    echo "Timer: on, every 5 minutes"
  else
    echo "Timer: off (scripts/after-merge.sh install)"
  fi
  local on
  on="$(switched_on | paste -sd ' ' -)"
  echo "Starts tickets for: ${on:-no project (scripts/after-merge.sh on <project>)}"
  echo "Log: journalctl --user -u $timer --since today"
}

cmd_install() {
  local source_dir
  source_dir=$(cd "$(dirname "$0")" && pwd)
  mkdir -p "$state" "$units"
  [[ $source_dir == "$state" ]] || install -m 755 "$source_dir/after-merge.sh" "$state/"
  # The timer runs without a login shell, so it gets this shell's PATH (claude, gh, jq).
  cat >"$units/$timer.service" <<EOF
[Unit]
Description=Stop merged ticket sessions and start the next ai_projects tickets

[Service]
Type=oneshot
Environment=PATH=$PATH
Environment=AFTER_MERGE_REPO=$repo
ExecStart=$state/after-merge.sh run
EOF
  cat >"$units/$timer.timer" <<EOF
[Unit]
Description=Act on merged ai_projects ticket PRs every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF
  ctl daemon-reload
  ctl enable --now "$timer.timer"
  echo "Installed. Switch projects on with: scripts/after-merge.sh on <project>"
}

cmd_uninstall() {
  ctl disable --now "$timer.timer" 2>/dev/null || true
  rm -f "$units/$timer.service" "$units/$timer.timer"
  ctl daemon-reload
  rm -rf "$state"
  echo "Uninstalled: the timer is off. Run stop-merged.sh and next-tickets.sh by hand again."
}

main() {
  case ${1:-} in
    install) cmd_install ;;
    uninstall) cmd_uninstall ;;
    on) cmd_on "${2:-}" ;;
    off) cmd_off "${2:-}" ;;
    status) cmd_status ;;
    run) cmd_run ;;
    -h | --help) usage 0 ;;
    *) usage 1 ;;
  esac
}

main "$@"
