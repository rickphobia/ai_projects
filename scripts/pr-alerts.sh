#!/usr/bin/env bash
# Tells the owner's phone when a ticket PR needs them: once when it is ready (ci-gate green and no
# merge conflict, with its "▶ Try this version" link), once when ci-gate fails, and once when it
# gets a merge conflict. Each is sent once per PR head commit. A ticket PR is one whose branch is
# <project>/<NN>-..., as next-tickets.sh names them. after-merge.sh runs a pass every 5 minutes, so
# it needs no Claude session: a background ticket session can't reach the phone itself.
#
# Notifications go to an ntfy topic (https://ntfy.sh, a free push app). The repo is public, so the
# topic lives outside it; anyone who knows the topic can read it, so it is a long random name.
#
# Usage: scripts/pr-alerts.sh [command]
#   (none)   one pass: send what's new
#   setup    make a topic if there is none, and say how to subscribe on the phone
#   test     send a test notification
#
# Settings (environment variables, all optional):
#   PR_ALERTS_NTFY_URL  the topic's URL (default: read from ~/.config/ai-projects/ntfy-url)
#   PR_ALERTS_STATE     where the sent list lives (default ~/.local/state/ai-projects-pr-alerts)
set -euo pipefail

config_file="$HOME/.config/ai-projects/ntfy-url"
state="${PR_ALERTS_STATE:-$HOME/.local/state/ai-projects-pr-alerts}"
sent_file="$state/sent"
# Enough to remember every open PR's last few commits; older lines are dropped.
readonly sent_keep=500

die() {
  printf 'pr-alerts: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '11,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

ntfy_url() {
  if [[ -n ${PR_ALERTS_NTFY_URL:-} ]]; then
    echo "$PR_ALERTS_NTFY_URL"
  elif [[ -s $config_file ]]; then
    tr -d '[:space:]' <"$config_file"
  fi
}

# notify <title> <message> <click url> [<try url>]: one push. Sent as JSON so a PR title with
# non-ASCII characters is fine, which HTTP headers are not.
notify() {
  local url
  url="$(ntfy_url)"
  if [[ -z $url ]]; then
    echo "pr-alerts: no ntfy topic (scripts/pr-alerts.sh setup), not sent: $1"
    return 0
  fi
  local body
  body="$(jq -n --arg topic "${url##*/}" --arg title "$1" --arg message "$2" --arg click "$3" \
    --arg try "${4:-}" '{topic: $topic, title: $title, message: $message, click: $click} +
      (if $try == "" then {} else {actions: [{action: "view", label: "Try it", url: $try}]} end)')"
  curl -fsS --max-time 20 -H 'Content-Type: application/json' -d "$body" "${url%/*}" >/dev/null ||
    die "couldn't reach ntfy for: $1"
  echo "pr-alerts: sent: $1"
}

# Prints "<number>\t<head sha>\t<kind>\t<title>\t<url>\t<try url>" for each open ticket PR that
# needs the owner: kind is ready, failed or conflict. A PR still running CI, or whose merge state
# GitHub hasn't worked out yet, prints nothing until a later pass.
needing_owner() {
  gh pr list --state open --limit 100 \
    --json number,title,url,headRefName,headRefOid,mergeable,statusCheckRollup,body |
    jq -r '
      .[]
      | select(.headRefName | test("^[a-z0-9-]+/[0-9]+-"))
      | ([.statusCheckRollup[]? | select(.name == "ci-gate")] | last) as $gate
      | (if .mergeable == "CONFLICTING" then "conflict"
         elif $gate == null or $gate.status != "COMPLETED" then empty
         elif $gate.conclusion == "SUCCESS" and .mergeable == "MERGEABLE" then "ready"
         elif ($gate.conclusion | IN("SUCCESS", "SKIPPED", "NEUTRAL")) then empty
         else "failed" end) as $kind
      | ((.body // "") | capture("▶ Try this version: \\[[^]]*\\]\\((?<u>[^)]+)\\)").u // "") as $try
      | [.number, .headRefOid, $kind, .title, .url, $try] | @tsv'
}

cmd_pass() {
  mkdir -p "$state"
  touch "$sent_file"
  local number sha kind title url try key
  while IFS=$'\t' read -r number sha kind title url try; do
    key="$number $sha $kind"
    grep -qxF "$key" "$sent_file" && continue
    case $kind in
      ready) notify "PR #$number ready to try and merge" "$title" "$url" "$try" ;;
      failed) notify "PR #$number: CI failed" "$title" "$url" ;;
      conflict) notify "PR #$number has a merge conflict" "$title. Its session stops once CI is green, so ask one to merge main in." "$url" ;;
    esac
    echo "$key" >>"$sent_file"
  done < <(needing_owner)
  tail -n "$sent_keep" "$sent_file" >"$sent_file.new"
  mv "$sent_file.new" "$sent_file"
}

cmd_setup() {
  if [[ -z $(ntfy_url) ]]; then
    mkdir -p "$(dirname "$config_file")"
    (umask 077 && echo "https://ntfy.sh/ai-projects-$(head -c 18 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')" >"$config_file")
  fi
  local url
  url="$(ntfy_url)"
  cat <<EOF
Topic: ${url##*/}
On the phone: install the ntfy app, tap +, and subscribe to that topic (server ntfy.sh).
Then check it with: scripts/pr-alerts.sh test
EOF
}

main() {
  case ${1:-} in
    "") cmd_pass ;;
    setup) cmd_setup ;;
    test) notify "ai_projects alerts work" "Ticket PRs will show up here when they need you." "https://github.com" ;;
    -h | --help) usage 0 ;;
    *) usage 1 ;;
  esac
}

main "$@"
