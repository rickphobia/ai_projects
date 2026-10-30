#!/usr/bin/env bash
# Tests scripts/after-merge.sh's run, on and off with stop-merged.sh, next-tickets.sh and pr-alerts.sh replaced
# by stubs that log their arguments, so nothing real is stopped or started.
# Run: scripts/tests/after-merge.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/after-merge.sh"
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

mkdir -p "$work/stubs" "$work/repo/projects/alpha" "$work/repo/projects/beta"
# The stubs' own $* and $STUB_LOG must stay unexpanded here.
# shellcheck disable=SC2016
for stub in stop-merged.sh next-tickets.sh pr-alerts.sh; do
  printf '#!/usr/bin/env bash\necho "%s $*" >>"$STUB_LOG"\n' "$stub" >"$work/stubs/$stub"
  chmod +x "$work/stubs/$stub"
done
export AFTER_MERGE_REPO="$work/repo" AFTER_MERGE_STATE="$work/state" \
  AFTER_MERGE_SCRIPTS="$work/stubs" STUB_LOG="$work/log"

"$script" run >/dev/null
check "with no project on, a pass only stops merged sessions" "stop-merged.sh " "$(cat "$work/log")"
check "with no project on, no tickets start" "0" "$(grep -c next-tickets "$work/log" || true)"
check "every pass sends PR alerts" "pr-alerts.sh" "$(cat "$work/log")"

check "a project can be switched on" "On: alpha" "$("$script" on alpha)"
"$script" on beta >/dev/null
check "switching on twice says so" "alpha is already on." "$("$script" on alpha)"
check "an unknown project is refused" "no project gamma" "$("$script" on gamma 2>&1 || true)"

: >"$work/log"
"$script" run >/dev/null
log="$(cat "$work/log")"
check "a pass stops merged sessions first" "stop-merged.sh " "$(head -1 "$work/log")"
check "a pass starts alpha's next tickets" "next-tickets.sh alpha --yes" "$log"
check "a pass starts beta's next tickets" "next-tickets.sh beta --yes" "$log"
check "a pass sends PR alerts last" "pr-alerts.sh" "$(tail -1 "$work/log")"

"$script" off alpha >/dev/null
: >"$work/log"
"$script" run >/dev/null
log="$(cat "$work/log")"
if [[ $log == *"next-tickets.sh alpha"* ]]; then
  echo "FAIL a switched-off project still starts tickets"
  failures=$((failures + 1))
else
  echo "ok   a switched-off project no longer starts tickets"
fi
check "the other project still starts tickets" "next-tickets.sh beta --yes" "$log"

# shellcheck disable=SC2016
printf '#!/usr/bin/env bash\necho "stop-merged.sh $*" >>"$STUB_LOG"\nexit 1\n' >"$work/stubs/stop-merged.sh"
: >"$work/log"
status=0
"$script" run >/dev/null || status=$?
check "a failed stop still lets tickets start" "next-tickets.sh beta --yes" "$(cat "$work/log")"
check "a failed step fails the pass" "1" "$status"

check "status lists the switched-on projects" "Starts tickets for: beta" "$("$script" status)"

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
