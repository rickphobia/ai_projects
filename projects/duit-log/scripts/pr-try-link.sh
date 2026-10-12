#!/usr/bin/env bash
# Puts a "▶ Try this version: <link>" line in a pull request body, read on stdin and written to
# stdout. The line replaces an earlier one, so each new Preview build updates it in place;
# otherwise it goes on the second line, where the owner looks for it.
# Usage: gh pr view N --json body -q .body | scripts/pr-try-link.sh <link text> <url>
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <link text> <url>  (PR body on stdin)" >&2
  exit 2
fi

marker="▶ Try this version"
line="$marker: [$1]($2)"
body="$(cat)"

if [[ -z $body ]]; then
  printf '%s\n' "$line"
elif grep -q "^$marker" <<<"$body"; then
  while IFS= read -r body_line; do
    if [[ $body_line == "$marker"* ]]; then
      printf '%s\n' "$line"
    else
      printf '%s\n' "$body_line"
    fi
  done <<<"$body"
else
  printf '%s\n%s\n' "${body%%$'\n'*}" "$line"
  if [[ $body == *$'\n'* ]]; then
    printf '%s\n' "${body#*$'\n'}"
  fi
fi
