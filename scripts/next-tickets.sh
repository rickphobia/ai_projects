#!/usr/bin/env bash
# Starts a background Claude Code session (`/implement`) for each ticket of a project that can
# start now: status `ready`, every ticket it is blocked by `done`, not already in progress, and
# not touching an area that another running or starting ticket touches. It also keeps the machine
# from being swamped: at most NEXT_TICKETS_MAX_SESSIONS ticket sessions run at once across all
# projects, and at most the number in `docs/tickets/.max-parallel` per project, if that file exists
# (RickNotes sets 1: each Android build takes 2-4 GB and most of the CPU).
#
# Usage: scripts/next-tickets.sh <project> [NN ...] [--dry-run] [--yes]
#   <project>   folder name under projects/
#   NN ...      only consider these ticket numbers (default: every ticket)
#   --dry-run   print the plan and the commands, start nothing
#   --yes       start without asking
#
# Ticket files are read from origin/main (fetched first), so the plan matches what the sessions
# will start from, whatever branch this checkout is on.
#
# Settings (environment variables, all optional):
#   NEXT_TICKETS_MODEL            model for the sessions (default claude-opus-5-5)
#   NEXT_TICKETS_PERMISSION_MODE  permission mode (default auto)
#   NEXT_TICKETS_REF              git ref to read tickets from (default origin/main)
#   NEXT_TICKETS_FETCH            1 to `git fetch` the ref's remote first, 0 to skip (default 1)
#   NEXT_TICKETS_MAX_SESSIONS     ticket sessions running at once, all projects (default 3)
set -euo pipefail

model="${NEXT_TICKETS_MODEL:-claude-opus-5-5}"
permission_mode="${NEXT_TICKETS_PERMISSION_MODE:-auto}"
ref="${NEXT_TICKETS_REF:-origin/main}"
fetch="${NEXT_TICKETS_FETCH:-1}"
max_sessions="${NEXT_TICKETS_MAX_SESSIONS:-3}"
[[ $max_sessions =~ ^[0-9]+$ ]] || { printf 'next-tickets: NEXT_TICKETS_MAX_SESSIONS must be a number\n' >&2; exit 1; }

die() {
  printf 'next-tickets: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '6,11p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# --- reading tickets -----------------------------------------------------------------------------

# Prints the value of a "**Field:** value" line in ticket text ($1), or nothing.
field() {
  sed -n -E "s/^\*\*$2:\*\*[[:space:]]*//p" <<<"$1" | head -n 1
}

# Prints the ticket numbers in a "Blocked by" value, ignoring titles in parentheses.
blocker_numbers() {
  sed -E 's/\([^)]*\)//g' <<<"$1" | grep -oE '\b[0-9]{2}\b' || true
}

# Prints a "Touches" value as one lowercase area per line, without parenthesised details.
touch_areas() {
  sed -E 's/\([^)]*\)//g' <<<"$1" | tr ',' '\n' | tr '[:upper:]' '[:lower:]' |
    sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | grep -v '^$' || true
}

# --- what is already running ---------------------------------------------------------------------

# Prints "NN<TAB>reason" for every ticket of the project that already has work going.
in_progress() {
  local project=$1 branch name
  # A local ticket branch: a session (any kind) is working on it. A branch can still equal the ref
  # before its first commit, so its existence is what counts; done tickets are ignored later.
  while read -r branch; do
    [[ $branch =~ ^$project/([0-9]{2})- ]] && printf '%s\tbranch %s\n' "${BASH_REMATCH[1]}" "$branch"
  done < <(git for-each-ref --format='%(refname:short)' "refs/heads/$project/")
  # A live background session started by this script.
  if command -v claude >/dev/null; then
    while read -r name; do
      [[ $name =~ ^$project-([0-9]{2})$ ]] && printf '%s\tbackground session %s\n' "${BASH_REMATCH[1]}" "$name"
    done < <(claude agents --json 2>/dev/null |
      jq -r '.[] | select(.kind == "background" and (.state == "working" or .state == "blocked")) | .name // empty' || true)
  fi
  # An open PR for the ticket.
  if command -v gh >/dev/null; then
    while read -r branch; do
      [[ $branch =~ ^$project/([0-9]{2})- ]] && printf '%s\topen PR on %s\n' "${BASH_REMATCH[1]}" "$branch"
    done < <(gh pr list --state open --json headRefName --jq '.[].headRefName' 2>/dev/null || true)
  fi
}

# Prints the names of live background ticket sessions (`<project>-NN`, working or blocked) of every
# project. Idle sessions are left out: they hold memory but no CPU, and stop-merged.sh stops them.
live_ticket_sessions() {
  command -v claude >/dev/null || return 0
  claude agents --json 2>/dev/null |
    jq -r '.[] | select(.kind == "background" and (.state == "working" or .state == "blocked")) | .name // empty' |
    grep -E '^[a-z0-9-]+-[0-9]{2}$' || true
}

# --- planning ------------------------------------------------------------------------------------

main() {
  local project="" dry_run=0 assume_yes=0
  local -a only=()
  while (($# > 0)); do
    case $1 in
      --dry-run) dry_run=1 ;;
      --yes) assume_yes=1 ;;
      -h | --help) usage 0 ;;
      -*) die "unknown option $1 (see --help)" ;;
      *)
        if [[ -z $project ]]; then project=$1
        elif [[ $1 =~ ^[0-9]{1,2}$ ]]; then only+=("$(printf '%02d' "$((10#$1))")")
        else die "not a ticket number: $1"
        fi
        ;;
    esac
    shift
  done
  [[ -n $project ]] || usage 1

  cd "$(git rev-parse --show-toplevel)"
  if [[ $fetch == 1 && $ref == */* ]]; then
    git fetch -q "${ref%%/*}" "${ref#*/}" || die "could not fetch $ref"
  fi
  local dir="projects/$project/docs/tickets"
  git cat-file -e "$ref:$dir" 2>/dev/null || die "no $dir on $ref"

  # Load every ticket.
  local -A status=() blockers=() areas=() effort=() path=() slug=()
  local -a numbers=()
  local file nn text
  while read -r file; do
    [[ $file =~ /([0-9]{2})-([^/]+)\.md$ ]] || continue
    nn=${BASH_REMATCH[1]}
    numbers+=("$nn")
    slug[$nn]=${BASH_REMATCH[2]}
    path[$nn]=$file
    text="$(git show "$ref:$file")"
    status[$nn]="$(field "$text" Status)"
    blockers[$nn]="$(blocker_numbers "$(field "$text" 'Blocked by')" | tr '\n' ' ')"
    areas[$nn]="$(touch_areas "$(field "$text" Touches)")"
    effort[$nn]="$(field "$text" Effort | grep -oE '^(low|medium|high)' || true)"
    if [[ -z ${effort[$nn]} ]]; then
      if [[ $nn == 01 ]]; then effort[$nn]=medium; else effort[$nn]=low; fi
    fi
  done < <(git ls-tree --name-only "$ref" "$dir/" | sort)
  ((${#numbers[@]} > 0)) || die "no tickets in $dir on $ref"

  # How many more sessions may start: the machine-wide limit, then the project's own.
  local -a live=()
  mapfile -t live < <(live_ticket_sessions)
  local slots=$((max_sessions - ${#live[@]})) project_live=0 name
  for name in "${live[@]}"; do [[ $name == "$project"-?? ]] && project_live=$((project_live + 1)); done
  local project_max=""
  project_max="$(git show "$ref:$dir/.max-parallel" 2>/dev/null | tr -dc '0-9' || true)"
  if [[ -n $project_max ]] && ((project_max - project_live < slots)); then
    slots=$((project_max - project_live))
  fi
  ((slots < 0)) && slots=0
  local limit_note="${#live[@]} ticket session(s) running, limit $max_sessions"
  [[ -n $project_max ]] && limit_note+="; $project_live of $project's, limit $project_max"

  local -A running=()
  local reason
  while IFS=$'\t' read -r nn reason; do
    [[ -n $nn ]] && running[$nn]=$reason
  done < <(in_progress "$project")

  # Areas already taken by running tickets: area -> ticket.
  local -A taken=()
  local area
  for nn in "${!running[@]}"; do
    [[ ${status[$nn]:-} == "done" ]] && continue
    while read -r area; do
      [[ -n $area ]] && taken[$area]=$nn
    done <<<"${areas[$nn]:-}"
  done

  printf '%s, tickets on %s (%s):\n' "$project" "$ref" "$(git rev-parse --short "$ref")"
  local -a start=()
  local b waiting clash
  for nn in "${numbers[@]}"; do
    if ((${#only[@]} > 0)) && [[ " ${only[*]} " != *" $nn "* ]]; then continue; fi
    local note
    if [[ ${status[$nn]} == "done" ]]; then
      note="done"
    elif [[ ${status[$nn]} != ready ]]; then
      note="status '${status[$nn]}' (only ready tickets start)"
    elif [[ -n ${running[$nn]:-} ]]; then
      note="in progress: ${running[$nn]}"
    else
      waiting=""
      for b in ${blockers[$nn]}; do
        [[ ${status[$b]:-} == "done" ]] || waiting+="$b "
      done
      clash=""
      while read -r area; do
        [[ -n $area && -n ${taken[$area]:-} ]] && clash+="'$area' with ${taken[$area]}; "
      done <<<"${areas[$nn]}"
      if [[ -n $waiting ]]; then
        note="waiting on ${waiting% }"
      elif [[ -n $clash ]]; then
        note="held back, touches ${clash%; }"
      elif ((${#start[@]} >= slots)); then
        note="held back, machine busy ($limit_note)"
      else
        note="START (effort ${effort[$nn]})"
        start+=("$nn")
        while read -r area; do
          [[ -n $area ]] && taken[$area]=$nn
        done <<<"${areas[$nn]}"
      fi
    fi
    printf '  %s %-40s %s\n' "$nn" "${slug[$nn]}" "$note"
  done

  if ((${#start[@]} == 0)); then
    echo "Nothing to start."
    return 0
  fi

  local -a commands=()
  for nn in "${start[@]}"; do
    commands+=("$(printf '%q ' claude --bg --name "$project-$nn" --model "$model" \
      --effort "${effort[$nn]}" --permission-mode "$permission_mode" \
      "/implement ${path[$nn]} (work on branch $project/$nn-${slug[$nn]})")")
  done
  echo
  echo "Commands:"
  printf '  %s\n' "${commands[@]}"

  if ((dry_run)); then
    echo "Dry run: nothing started."
    return 0
  fi
  if ((!assume_yes)); then
    local answer
    read -r -p "Start ${#start[@]} background session(s)? [y/N] " answer
    [[ $answer == [yY]* ]] || { echo "Nothing started."; return 0; }
  fi
  local command
  for command in "${commands[@]}"; do
    eval "$command"
  done
  echo
  echo "Started. Watch and answer them with: claude agents"
}

main "$@"
