#!/usr/bin/env bash
# Put the previous rss-news image back. Run it again to undo the rollback.
# Settings come from the same environment variables as update-site.sh.
set -Eeuo pipefail

SCRIPT_NAME="rollback"
# shellcheck source=deploy/settings.sh
source "$(dirname "${BASH_SOURCE[0]}")/settings.sh"

trap 'log "FAILED. The current container is still running."' ERR

take_lock
check_host_setup

if [ ! -f "$PREVIOUS_TAG_FILE" ]; then
  log "no previous deploy recorded in $PREVIOUS_TAG_FILE; nothing to roll back to"
  exit 1
fi
previous="$(cat "$PREVIOUS_TAG_FILE")"
current="$(cat "$DEPLOYED_TAG_FILE")"
if ! docker image inspect "$IMAGE_REPO:$previous" >/dev/null 2>&1; then
  log "image $IMAGE_REPO:$previous is gone (pruned?); deploy a fixed main instead"
  exit 1
fi

log "rolling back from $current to $previous"
swap_to "$previous"
printf '%s\n' "$current" >"$PREVIOUS_TAG_FILE"
printf '%s\n' "$previous" >"$DEPLOYED_TAG_FILE"
log "rolled back to $previous. the next update-site.sh run puts main back, so fix main first."
