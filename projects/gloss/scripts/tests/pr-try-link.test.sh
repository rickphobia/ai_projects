#!/usr/bin/env bash
# Tests scripts/pr-try-link.sh on sample PR bodies. Run: scripts/tests/pr-try-link.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/pr-try-link.sh"
failures=0

check() { # check <description> <PR body> <expected new body>
  local actual
  actual="$(printf '%s' "$2" | "$script" "Build 7" "https://example.com/7.apk")"
  if [[ $actual == "$3" ]]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s\n--- expected\n%s\n--- actual\n%s\n' "$1" "$3" "$actual"
    failures=$((failures + 1))
  fi
}

link="▶ Try this version: [Build 7](https://example.com/7.apk)"

check "empty body gets just the line" "" "$link"

check "line goes second when there is none" \
  $'Adds a thing.\n\n## Why\nBecause.' \
  $'Adds a thing.\n'"$link"$'\n\n## Why\nBecause.'

check "an earlier line is replaced in place" \
  $'Adds a thing.\n▶ Try this version: [Build 6](https://example.com/6.apk)\n\nMore.' \
  $'Adds a thing.\n'"$link"$'\n\nMore.'

check "a one-line body keeps its line first" "Adds a thing." $'Adds a thing.\n'"$link"

if ! "$script" only-one-argument </dev/null 2>/dev/null; then
  printf 'ok   %s\n' "wrong arguments fail"
else
  printf 'FAIL %s\n' "wrong arguments fail"
  failures=$((failures + 1))
fi

if ((failures > 0)); then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
