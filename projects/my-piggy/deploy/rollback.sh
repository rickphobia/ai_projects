#!/usr/bin/env bash
# Put the previous My Piggy build back. Run it again to undo the rollback.
# Settings come from the same environment variables as update-site.sh.
set -euo pipefail

SRC_DIR="${MY_PIGGY_SRC_DIR:-$HOME/homelab/dev/ai_projects}"
SITE_ROOT="${MY_PIGGY_SITE_ROOT:-$HOME/homelab/html}"
SITE_SUBPATH="${MY_PIGGY_SITE_SUBPATH:-ai-projects/my-piggy}"

LIVE_DIR="$SITE_ROOT/$SITE_SUBPATH"
PREVIOUS_DIR="$LIVE_DIR.previous"
SWAP_DIR="$LIVE_DIR.swap"
DEPLOYED_COMMIT_FILE="$(dirname "$SRC_DIR")/my-piggy.deployed-commit"

log() { printf '%s rollback: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

if [ ! -f "$PREVIOUS_DIR/index.html" ]; then
  log "no previous build in $PREVIOUS_DIR; nothing to roll back to"
  exit 1
fi

rm -rf "$SWAP_DIR"
mv "$LIVE_DIR" "$SWAP_DIR"
mv "$PREVIOUS_DIR" "$LIVE_DIR"
mv "$SWAP_DIR" "$PREVIOUS_DIR"
# Forget the deployed commit so the next update-site.sh run rebuilds instead of skipping.
rm -f "$DEPLOYED_COMMIT_FILE"
log "swapped $LIVE_DIR and $PREVIOUS_DIR. The next update-site.sh run puts the latest main back."
