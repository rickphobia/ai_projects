#!/usr/bin/env bash
# Export My Piggy's web build from the latest `main` and publish it to the nginx site root.
# Run on the server. Safe to run often: it does nothing when `main` has not changed.
# Settings come from environment variables; see "Deploy" in the project README.
set -Eeuo pipefail

REPO_URL="${MY_PIGGY_REPO_URL:-https://github.com/rickphobia/ai_projects.git}"
BRANCH="${MY_PIGGY_BRANCH:-main}"
SRC_DIR="${MY_PIGGY_SRC_DIR:-$HOME/homelab/dev/ai_projects}"
SITE_ROOT="${MY_PIGGY_SITE_ROOT:-$HOME/homelab/html}"
SITE_SUBPATH="${MY_PIGGY_SITE_SUBPATH:-ai-projects/my-piggy}"
FORCE="${MY_PIGGY_FORCE:-0}"

PROJECT_SUBDIR="projects/my-piggy"
LIVE_DIR="$SITE_ROOT/$SITE_SUBPATH"
NEW_DIR="$LIVE_DIR.new"
PREVIOUS_DIR="$LIVE_DIR.previous"
DEPLOYED_COMMIT_FILE="$(dirname "$SRC_DIR")/my-piggy.deployed-commit"
LOCK_FILE="$(dirname "$SRC_DIR")/my-piggy.lock"

log() { printf '%s update-site: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
step="starting"
trap 'log "FAILED while ${step}. The live site was not changed unless the step was \"swapping folders\"."' ERR

# Everything runs inside main() so bash reads the whole script up front; the checkout below
# replaces this very file, and bash must not read a half-changed script.
main() {
  step="taking the lock"
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "another update is already running; exiting"
    exit 0
  fi

  step="fetching $BRANCH"
  if [ ! -d "$SRC_DIR/.git" ]; then
    log "cloning $REPO_URL into $SRC_DIR"
    git clone --quiet --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
  fi
  git -C "$SRC_DIR" fetch --quiet origin "$BRANCH"
  # The checkout is only ever built from, so discarding local changes is safe.
  git -C "$SRC_DIR" checkout --quiet --force --detach FETCH_HEAD
  commit="$(git -C "$SRC_DIR" rev-parse HEAD)"

  if [ "$FORCE" != "1" ] && [ -f "$DEPLOYED_COMMIT_FILE" ] \
    && [ "$(cat "$DEPLOYED_COMMIT_FILE")" = "$commit" ] && [ -f "$LIVE_DIR/index.html" ]; then
    log "$BRANCH is still at ${commit:0:8}; nothing to do (MY_PIGGY_FORCE=1 rebuilds anyway)"
    exit 0
  fi

  project_dir="$SRC_DIR/$PROJECT_SUBDIR"
  # The image tag is the Godot version, so a version bump in godot-pin.env builds a new image
  # and an unchanged pin reuses the cached one.
  # shellcheck source=../scripts/godot-pin.env
  source "$project_dir/scripts/godot-pin.env"
  image="my-piggy-godot:$GODOT_VERSION"

  step="building the Godot $GODOT_VERSION image ($image)"
  log "$step"
  docker build --quiet --tag "$image" --file "$project_dir/deploy/Dockerfile" "$project_dir" >/dev/null

  step="exporting ${commit:0:8} in $image"
  log "$step"
  rm -rf "$project_dir/build/web" "$project_dir/.godot"
  mkdir -p "$project_dir/build/web"
  # Which build this is, shown on the title screen (src/config/build_version.gd).
  printf 'main %s · %s\n' "${commit:0:7}" "$(git -C "$SRC_DIR" log -1 --format=%cs "$commit")" \
    >"$project_dir/version.txt"
  # Run as the current user so the build files are not owned by root. The import comes first
  # because a fresh checkout has no .godot cache and the export needs one.
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "$project_dir:/app" \
    --workdir /app \
    --env HOME=/tmp \
    --env XDG_CONFIG_HOME=/tmp/config \
    --env XDG_CACHE_HOME=/tmp/cache \
    "$image" \
    sh -c 'godot --headless --import && godot --headless --export-release Web build/web/index.html'
  for built in index.html index.wasm index.pck; do
    if [ ! -s "$project_dir/build/web/$built" ]; then
      log "the export finished but build/web/$built is missing or empty"
      false
    fi
  done

  step="copying the build next to the live folder"
  mkdir -p "$(dirname "$LIVE_DIR")"
  rm -rf "$NEW_DIR"
  cp -a "$project_dir/build/web" "$NEW_DIR"

  step="swapping folders"
  # Two renames in a row; the gap between them is a few milliseconds.
  if [ -d "$LIVE_DIR" ]; then
    rm -rf "$PREVIOUS_DIR"
    mv "$LIVE_DIR" "$PREVIOUS_DIR"
  fi
  mv "$NEW_DIR" "$LIVE_DIR"
  printf '%s\n' "$commit" >"$DEPLOYED_COMMIT_FILE"
  log "deployed ${commit:0:8} to $LIVE_DIR (previous build kept in $PREVIOUS_DIR)"
}

main "$@"
