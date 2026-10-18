#!/usr/bin/env bash
# Put the previous Happy Cotton build back. Run it again to undo the rollback.
# Settings come from the same environment variables as update-site.sh.
set -euo pipefail

SRC_DIR="${HAPPY_COTTON_SRC_DIR:-$HOME/homelab/dev/ai_projects}"
SITE_ROOT="${HAPPY_COTTON_SITE_ROOT:-$HOME/homelab/html}"
SITE_SUBPATH="${HAPPY_COTTON_SITE_SUBPATH:-ai-projects/happy-cotton}"

LIVE_DIR="$SITE_ROOT/$SITE_SUBPATH"
PREVIOUS_DIR="$LIVE_DIR.previous"
SWAP_DIR="$LIVE_DIR.swap"
DEPLOYED_COMMIT_FILE="$(dirname "$SRC_DIR")/happy-cotton.deployed-commit"

log() { printf '%s rollback: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

if [ ! -f "$PREVIOUS_DIR/index.html" ]; then
  log "no previous build in $PREVIOUS_DIR; nothing to roll back to"
  exit 1
fi
if [ ! -d "$LIVE_DIR" ]; then
  log "no live build in $LIVE_DIR; run update-site.sh instead"
  exit 1
fi

rm -rf "$SWAP_DIR"
mv "$LIVE_DIR" "$SWAP_DIR"
mv "$PREVIOUS_DIR" "$LIVE_DIR"
mv "$SWAP_DIR" "$PREVIOUS_DIR"
# Forget the deployed commit so the next update-site.sh run rebuilds instead of skipping.
rm -f "$DEPLOYED_COMMIT_FILE"
log "swapped $LIVE_DIR and $PREVIOUS_DIR; the next update-site.sh run puts the latest ${HAPPY_COTTON_BRANCH:-main} back"
