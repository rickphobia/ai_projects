#!/usr/bin/env bash
# Tests scripts/pr-alerts.sh with gh replaced by a stub that prints a canned PR list and curl by
# one that logs what it would send, so nothing reaches GitHub or ntfy.
# Run: scripts/tests/pr-alerts.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/pr-alerts.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

check() { # check <description> <expected substring> <actual text>
  if [[ $3 == *"$2"* ]]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n     expected to find: %s\n     got: %s\n' "$1" "$2" "$3"
    failures=$((failures + 1))
  fi
}

refute() { # refute <description> <unexpected substring> <actual text>
  if [[ $3 == *"$2"* ]]; then
    printf 'FAIL %s\n     did not expect: %s\n     got: %s\n' "$1" "$2" "$3"
    failures=$((failures + 1))
  else
    printf 'ok   %s\n' "$1"
  fi
}

mkdir -p "$work/bin"
# The stubs' own variables must stay unexpanded here.
# shellcheck disable=SC2016
printf '#!/usr/bin/env bash\ncat "$GH_PRS"\n' >"$work/bin/gh"
# shellcheck disable=SC2016
printf '#!/usr/bin/env bash\nprintf "%%s " "$@" >>"$CURL_LOG"\necho >>"$CURL_LOG"\n' >"$work/bin/curl"
chmod +x "$work/bin/gh" "$work/bin/curl"
export PATH="$work/bin:$PATH" GH_PRS="$work/prs.json" CURL_LOG="$work/curl.log" \
  PR_ALERTS_STATE="$work/state" PR_ALERTS_NTFY_URL="https://ntfy.example/topic-abc" HOME="$work/home"

gate() { # gate <status> <conclusion>
  printf '{"name": "check", "status": "COMPLETED", "conclusion": "FAILURE"}, {"name": "ci-gate", "status": "%s", "conclusion": "%s"}' "$1" "$2"
}
pr() { # pr <number> <branch> <sha> <mergeable> <checks json>
  printf '{"number": %s, "title": "ricknotes: Thing %s", "url": "https://gh/pr/%s", "headRefName": "%s", "headRefOid": "%s", "mergeable": "%s", "statusCheckRollup": [%s], "body": "Ticket: x\\n▶ Try this version: [Build 9 (APK)](https://dl/%s.apk)\\n"}' \
    "$1" "$1" "$1" "$2" "$3" "$4" "$5" "$1"
}

cat >"$GH_PRS" <<EOF
[
  $(pr 1 ricknotes/46-send-both-panes aaa MERGEABLE "$(gate COMPLETED SUCCESS)"),
  $(pr 2 ricknotes/47-later bbb MERGEABLE "$(gate IN_PROGRESS "")"),
  $(pr 3 rss-news/12-feeds ccc MERGEABLE "$(gate COMPLETED FAILURE)"),
  $(pr 4 gloss/03-context ddd CONFLICTING "$(gate COMPLETED SUCCESS)"),
  $(pr 5 ricknotes/fix-send-to-crash eee MERGEABLE "$(gate COMPLETED SUCCESS)"),
  $(pr 6 ricknotes/48-unknown fff UNKNOWN "$(gate COMPLETED SUCCESS)")
]
EOF

out="$("$script")"
sent="$(cat "$work/curl.log")"
check "a green, mergeable ticket PR is sent as ready" "PR #1 ready to try and merge" "$out"
check "the ready alert carries the Try this version link" "https://dl/1.apk" "$sent"
check "it is sent to the topic's server with the topic in the body" '"topic":"topic-abc"' "$(tr -d ' \n' <"$work/curl.log")"
check "it goes to the server, not the topic URL" "https://ntfy.example" "$sent"
refute "a PR still running CI is not sent" "PR #2" "$out"
check "a failed ci-gate is sent" "PR #3: CI failed" "$out"
check "a merge conflict is sent" "PR #4 has a merge conflict" "$out"
refute "a PR that isn't a ticket PR is not sent" "PR #5" "$out"
refute "a PR whose merge state is unknown yet is not sent" "PR #6" "$out"

: >"$work/curl.log"
out="$("$script")"
refute "nothing is sent twice for the same commit" "PR #" "$out"
check "no second push either" "0" "$(grep -c . "$work/curl.log" || true)"

sed -i 's/"headRefOid": "aaa"/"headRefOid": "aa2"/' "$GH_PRS"
out="$("$script")"
check "a new commit that is green again is sent again" "PR #1 ready to try and merge" "$out"

unset PR_ALERTS_NTFY_URL
rm -rf "$work/state"
: >"$work/curl.log"
out="$("$script")"
check "without a topic it says what it didn't send" "no ntfy topic" "$out"
check "without a topic nothing is sent" "0" "$(grep -c . "$work/curl.log" || true)"

out="$("$script" setup)"
check "setup makes a topic" "Topic: ai-projects-" "$out"
check "setup keeps the topic private to the user" "600" "$(stat -c %a "$work/home/.config/ai-projects/ntfy-url")"
topic="$(cat "$work/home/.config/ai-projects/ntfy-url")"
"$script" setup >/dev/null
check "setup keeps an existing topic" "$topic" "$(cat "$work/home/.config/ai-projects/ntfy-url")"

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
