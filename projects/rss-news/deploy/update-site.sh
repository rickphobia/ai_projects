#!/usr/bin/env bash
# Build rss-news from the latest `main` into a Docker image and swap the running container.
# Run on the server. Safe to run often: it does nothing when `main` has not changed.
# Settings come from environment variables; see "Deploy" in the project README.
set -Eeuo pipefail

SCRIPT_NAME="update-site"
# Sourced before the checkout below replaces it, so the functions are already in memory; sourced
# again from the new checkout once it is in place.
# shellcheck source=deploy/settings.sh
source "$(dirname "${BASH_SOURCE[0]}")/settings.sh"

step="starting"
trap 'log "FAILED while ${step}. The old container, if any, is still running."' ERR

# Everything runs inside main() so bash reads the whole script up front; the checkout below
# replaces this very file, and bash must not read a half-changed script.
main() {
step="taking the lock"
take_lock

step="checking the env file and data folder"
check_host_setup

step="fetching $BRANCH"
if [ ! -d "$SRC_DIR/.git" ]; then
  log "cloning $REPO_URL into $SRC_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi
git -C "$SRC_DIR" fetch --quiet origin "$BRANCH"
# The checkout is only ever built from, so discarding local changes is safe.
git -C "$SRC_DIR" checkout --quiet --force --detach FETCH_HEAD
# Load the settings again from the commit being deployed: the ones sourced above may be older (a
# changed data mount, say). Changes to this file itself only apply from the next run.
# shellcheck source=deploy/settings.sh
source "$SRC_DIR/projects/rss-news/deploy/settings.sh"
tag="$(git -C "$SRC_DIR" rev-parse --short=12 HEAD)"

if [ "$FORCE" != "1" ] && [ -f "$DEPLOYED_TAG_FILE" ] \
  && [ "$(cat "$DEPLOYED_TAG_FILE")" = "$tag" ] \
  && [ -n "$(docker ps --quiet --filter "name=^rss-news-$tag-")" ]; then
  log "$BRANCH is still at $tag; nothing to do (RSS_NEWS_FORCE=1 redeploys anyway)"
  exit 0
fi

step="building image $IMAGE_REPO:$tag"
log "$step"
docker build --quiet --tag "$IMAGE_REPO:$tag" "$SRC_DIR/projects/rss-news" >/dev/null

step="starting $IMAGE_REPO:$tag and checking /healthz"
swap_to "$tag"

if [ -f "$DEPLOYED_TAG_FILE" ] && [ "$(cat "$DEPLOYED_TAG_FILE")" != "$tag" ]; then
  cp "$DEPLOYED_TAG_FILE" "$PREVIOUS_TAG_FILE"
fi
printf '%s\n' "$tag" >"$DEPLOYED_TAG_FILE"
log "deployed $tag (previous: $(cat "$PREVIOUS_TAG_FILE" 2>/dev/null || echo none))"
}

main "$@"
