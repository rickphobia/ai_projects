#!/usr/bin/env bash
# Tests scripts/stop-merged.sh with `claude` and `gh` replaced by stubs, so nothing real is
# stopped. Run: scripts/tests/stop-merged.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/stop-merged.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

check() { # check <description> <expected substring> <actual text>
  if [[ $3 == *"$2"* ]]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n     expected to find: %s\n' "$1" "$2"
    failures=$((failures + 1))
  fi
}

# Stubs: `claude agents --json` lists sessions; `claude stop` logs its id. `gh pr list` answers
# with the merged or open PRs depending on --state.
mkdir -p "$work/bin"
cat >"$work/bin/claude" <<'EOF'
#!/usr/bin/env bash
if [[ $1 == agents ]]; then
  echo '[{"kind":"background","state":"done","name":"alpha-03","id":"a3"},
         {"kind":"background","state":"blocked","name":"alpha-04","id":"a4"},
         {"kind":"background","state":"working","name":"alpha-05","id":"a5"},
         {"kind":"background","state":"done","name":"alpha-06","id":"a6"},
         {"kind":"background","state":"done","name":"alpha-07","id":"a7"},
         {"kind":"background","state":"done","name":"beta-01","id":"b1"},
         {"kind":"background","state":"done","name":"scratch","id":"s0"},
         {"kind":"interactive","state":null,"name":"alpha-08","id":"a8"}]'
elif [[ $1 == stop ]]; then
  echo "$2" >>"$CLAUDE_STUB_LOG"
fi
EOF
cat >"$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
if [[ " $* " == *" merged "* ]]; then
  printf '%s\n' "alpha/03-first	11" "alpha/04-second	12" "alpha/05-third	13" \
    "alpha/06-fourth	14" "alpha/08-sixth	16" "beta/01-skeleton	21"
else
  printf '%s\n' "alpha/06-fourth-follow-up"
fi
EOF
chmod +x "$work/bin/claude" "$work/bin/gh"
export PATH="$work/bin:$PATH" CLAUDE_STUB_LOG="$work/claude.log"

dry="$("$script" alpha --dry-run)"
echo "$dry"
echo
check "a dry run names a done session with a merged PR" "alpha-03                     would stop (PR #11 merged)" "$dry"
check "a dry run stops nothing" "Dry run: nothing stopped." "$dry"
if [[ -e $CLAUDE_STUB_LOG ]]; then
  echo "FAIL a dry run called claude stop"
  failures=$((failures + 1))
else
  echo "ok   a dry run calls no claude stop"
fi

out="$("$script" alpha)"
echo "$out"
echo
stops="$(tr '\n' ' ' <"$CLAUDE_STUB_LOG")"
check "a done session with a merged PR is stopped" "alpha-03                     stopped (PR #11 merged; reopen with: claude attach a3)" "$out"
check "a session waiting for input with a merged PR is stopped" "alpha-04                     stopped (PR #12 merged" "$out"
check "a working session is kept" "alpha-05                     kept: PR #13 is merged but the session is still working" "$out"
check "a ticket with another open PR is kept" "alpha-06                     kept: PR #14 is merged but another PR on alpha/06-… is open" "$out"
check "the count is right" "Stopped 2 session(s)." "$out"
check "exactly the merged, idle sessions get claude stop" "a3 a4 " "$stops"
if [[ $stops == "a3 a4 " ]]; then
  echo "ok   nothing else is stopped (no PR, other project, interactive)"
else
  echo "FAIL stopped: $stops"
  failures=$((failures + 1))
fi

rm "$CLAUDE_STUB_LOG"
all="$("$script")"
check "without a project, every project's sessions are checked" "beta-01                      stopped (PR #21 merged" "$all"

if ((failures > 0)); then
  printf '\n%d check(s) failed\n' "$failures"
  exit 1
fi
echo
echo "All checks passed."
