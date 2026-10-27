#!/usr/bin/env bash
# Tests scripts/next-tickets.sh against a throwaway repo of fixture tickets, with `claude` and
# `gh` replaced by stubs, so nothing real is started. Run: scripts/tests/next-tickets.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/next-tickets.sh"
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

ticket() { # ticket <file> <status> <blocked by> <touches> [extra line]
  cat >"$work/repo/projects/fixture/docs/tickets/$1" <<EOF
# $1

**What to build:** something.

**Blocked by:** $3

**Status:** $2

**Touches:** $4
${5:-}

- [ ] it works
EOF
}

# Stubs: `claude agents --json` reports one running background session of this project and one
# of another; `claude --bg` logs its arguments; `gh` reports no open PRs.
mkdir -p "$work/bin" "$work/repo/projects/fixture/docs/tickets"
cat >"$work/bin/claude" <<'EOF'
#!/usr/bin/env bash
if [[ $1 == agents ]]; then
  echo '[{"kind":"background","state":"blocked","name":"fixture-07"},
         {"kind":"background","state":"working","name":"other-03"},
         {"kind":"background","state":"done","name":"fixture-04"},
         {"kind":"interactive","state":null,"name":"fixture-02"}]'
else
  printf '%s|' "$@" >>"$CLAUDE_STUB_LOG"
  # Record anything the session would read from stdin: it would land in its prompt.
  if IFS= read -r -t 1 line; then printf 'stdin:%s|' "$line" >>"$CLAUDE_STUB_LOG"; fi
  echo >>"$CLAUDE_STUB_LOG"
fi
EOF
printf '#!/usr/bin/env bash\necho ""\n' >"$work/bin/gh"
# `systemd-run` logs its options, then runs the command after them.
cat >"$work/bin/systemd-run" <<'EOF'
#!/usr/bin/env bash
options=()
while [[ $1 == --* ]]; do options+=("$1"); shift; done
printf 'scope:%s|' "${options[*]}" >>"$CLAUDE_STUB_LOG"
exec "$@"
EOF
chmod +x "$work/bin/claude" "$work/bin/gh" "$work/bin/systemd-run"
export PATH="$work/bin:$PATH" CLAUDE_STUB_LOG="$work/claude.log"
# A limit high enough that only the ticket rules decide; the limits have their own checks below.
export NEXT_TICKETS_REF=main NEXT_TICKETS_FETCH=0 NEXT_TICKETS_MAX_SESSIONS=10

ticket 01-skeleton.md "done" "None (can start immediately)" "everything"
ticket 02-alpha.md ready "01 (Skeleton)" "Alpha, Night"
ticket 03-beta.md ready "01 (Skeleton)" "Beta (x, y), night"
ticket 04-gamma.md ready "01" "Gamma" "**Effort:** medium"
ticket 05-delta.md ready "02 (Alpha)" "Delta"
ticket 06-epsilon.md "in review (waiting on the owner)" "01" "Epsilon"
ticket 07-zeta.md ready "None (can start immediately)" "Zeta"
ticket 08-eta.md ready "01" "Eta"
ticket 09-theta.md ready "01 (Full army and 10 waves)" "Theta"
git -C "$work/repo" init -q -b main
git -C "$work/repo" -c user.name=t -c user.email=t@t add -A
git -C "$work/repo" -c user.name=t -c user.email=t@t commit -q -m tickets
git -C "$work/repo" branch fixture/08-eta

cd "$work/repo"
plan="$("$script" fixture --dry-run)"
echo "$plan"
echo
check "a done ticket is skipped" "01 skeleton                                 done" "$plan"
check "an unblocked ticket starts at low effort" "02 alpha                                    START (effort low)" "$plan"
check "a ticket sharing an area (any case) is held back" "03 beta                                     held back, touches 'night' with 02" "$plan"
check "the Effort field sets the effort" "04 gamma                                    START (effort medium)" "$plan"
check "a finished background session doesn't count as running" "04 gamma" "$plan"
check "a ticket with an unfinished blocker waits" "05 delta                                    waiting on 02" "$plan"
check "only ready tickets start" "06 epsilon                                  status 'in review (waiting on the owner)'" "$plan"
check "a running background session is in progress" "07 zeta                                     in progress: background session fixture-07" "$plan"
check "a local ticket branch is in progress" "08 eta                                      in progress: branch fixture/08-eta" "$plan"
check "numbers inside a blocker's title are ignored" "09 theta                                    START (effort low)" "$plan"
check "the command names the session and the ticket" "--name fixture-02 --model claude-opus-5-5 --effort low --permission-mode auto" "$plan"
check "a dry run starts nothing" "Dry run: nothing started." "$plan"
if [[ -e $CLAUDE_STUB_LOG ]]; then
  echo "FAIL the dry run launched a session"
  failures=$((failures + 1))
else
  echo "ok   no session was launched by the dry run"
fi

only="$("$script" fixture 3 --dry-run)"
check "naming a ticket considers only that ticket" "03 beta                                     START (effort low)" "$only"

"$script" fixture --yes >/dev/null
launched="$(cat "$CLAUDE_STUB_LOG")"
check "--yes launches ticket 02 in the background" "--bg|--name|fixture-02|--model|claude-opus-5-5|--effort|low|--permission-mode|auto|/implement projects/fixture/docs/tickets/02-alpha.md (work on branch fixture/02-alpha)|" "$launched"
check "--yes launches ticket 04 at medium" "--name|fixture-04|--model|claude-opus-5-5|--effort|medium|" "$launched"
check "--yes launches ticket 09" "--name|fixture-09|" "$launched"
count=$(grep -c . "$CLAUDE_STUB_LOG")
check "exactly 3 sessions were launched" "3" "$count"
check "each session starts in its own systemd scope" "scope:--user --scope --quiet --collect|--bg|--name|fixture-02|" "$launched"

rm "$CLAUDE_STUB_LOG"
NEXT_TICKETS_OWN_SCOPE=0 "$script" fixture 2 --yes >/dev/null
unscoped="$(cat "$CLAUDE_STUB_LOG")"
check "NEXT_TICKETS_OWN_SCOPE=0 still launches the session" "--bg|--name|fixture-02|" "$unscoped"
if [[ $unscoped == *scope:* ]]; then
  echo "FAIL NEXT_TICKETS_OWN_SCOPE=0 still used systemd-run"
  failures=$((failures + 1))
else
  echo "ok   NEXT_TICKETS_OWN_SCOPE=0 starts the session directly"
fi

# after-merge.sh runs next-tickets.sh inside a loop reading project names from stdin; a launched
# session must not read the next name as part of its prompt.
rm "$CLAUDE_STUB_LOG"
printf 'other-project\n' | "$script" fixture --yes >/dev/null
piped="$(cat "$CLAUDE_STUB_LOG")"
if [[ $piped == *stdin:* ]]; then
  echo "FAIL a launched session read the caller's stdin"
  failures=$((failures + 1))
else
  echo "ok   a launched session doesn't read the caller's stdin"
fi

declined="$(echo n | "$script" fixture)"
check "answering no starts nothing" "Nothing started." "$declined"

# Machine-wide limit: 2 sessions are live (fixture-07, other-03), so a limit of 3 leaves one slot.
busy="$(NEXT_TICKETS_MAX_SESSIONS=3 "$script" fixture --dry-run)"
check "the machine limit starts what fits" "02 alpha                                    START (effort low)" "$busy"
check "the machine limit holds back the rest" "04 gamma                                    held back, machine busy (2 ticket session(s) running, limit 3)" "$busy"
full="$(NEXT_TICKETS_MAX_SESSIONS=2 "$script" fixture --dry-run)"
check "a full machine starts nothing" "Nothing to start." "$full"
bad="$(NEXT_TICKETS_MAX_SESSIONS=many "$script" fixture --dry-run 2>&1 || true)"
check "a non-number limit is refused" "NEXT_TICKETS_MAX_SESSIONS must be a number" "$bad"

# Project limit: only this project's live session (fixture-07) counts against .max-parallel.
echo 2 >projects/fixture/docs/tickets/.max-parallel
git add projects/fixture/docs/tickets/.max-parallel
git -c user.name=t -c user.email=t@t commit -q -m limit
capped="$("$script" fixture --dry-run)"
check "the project limit starts what fits" "02 alpha                                    START (effort low)" "$capped"
check "the project limit holds back the rest" "04 gamma                                    held back, machine busy (2 ticket session(s) running, limit 10; 1 of fixture's, limit 2)" "$capped"

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
