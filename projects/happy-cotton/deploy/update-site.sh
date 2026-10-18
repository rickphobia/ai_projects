#!/usr/bin/env bash
# Build Happy Cotton's web export from the latest `main` and publish it to the nginx site root.
# Run on the server. Safe to run often: it does nothing when `main` has not changed.
# Settings come from environment variables; see "Deploy" in the project README.
set -Eeuo pipefail

REPO_URL="${HAPPY_COTTON_REPO_URL:-https://github.com/rickphobia/ai_projects.git}"
BRANCH="${HAPPY_COTTON_BRANCH:-main}"
SRC_DIR="${HAPPY_COTTON_SRC_DIR:-$HOME/homelab/dev/ai_projects}"
SITE_ROOT="${HAPPY_COTTON_SITE_ROOT:-$HOME/homelab/html}"
SITE_SUBPATH="${HAPPY_COTTON_SITE_SUBPATH:-ai-projects/happy-cotton}"
FORCE="${HAPPY_COTTON_FORCE:-0}"

PROJECT_SUBDIR="projects/happy-cotton"
LIVE_DIR="$SITE_ROOT/$SITE_SUBPATH"
NEW_DIR="$LIVE_DIR.new"
PREVIOUS_DIR="$LIVE_DIR.previous"
DEPLOYED_COMMIT_FILE="$(dirname "$SRC_DIR")/happy-cotton.deployed-commit"
LOCK_FILE="$(dirname "$SRC_DIR")/happy-cotton.lock"

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

  if [ "$FORCE" != "1" ] && [ -f "$DEPLOYED_COMMIT_FILE" ] &&
    [ "$(cat "$DEPLOYED_COMMIT_FILE")" = "$commit" ] && [ -f "$LIVE_DIR/index.html" ]; then
    log "$BRANCH is still at ${commit:0:8}; nothing to do (HAPPY_COTTON_FORCE=1 rebuilds anyway)"
    exit 0
  fi

  project_dir="$SRC_DIR/$PROJECT_SUBDIR"
  # shellcheck source=../scripts/godot-pin.env
  source "$project_dir/scripts/godot-pin.env"
  image="happy-cotton-godot:$GODOT_VERSION"

  step="building the $image image"
  log "$step"
  # Cached after the first run; rebuilt when the pin or the Dockerfile changes.
  docker build --quiet --tag "$image" --file "$project_dir/deploy/Dockerfile" "$project_dir/scripts" >/dev/null

  step="exporting ${commit:0:8} in $image"
  log "$step"
  rm -rf "$project_dir/build/web" "$project_dir/.godot"
  mkdir -p "$project_dir/build/web"
  printf '%s %s\n' "${commit:0:8}" "$(git -C "$SRC_DIR" log -1 --format=%cs HEAD)" >"$project_dir/version.txt"
  # Run as the current user so the build files are not owned by root.
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "$project_dir:/app" \
    --workdir /app \
    --env HOME=/tmp \
    "$image" \
    sh -c 'godot --headless --import && godot --headless --export-release Web build/web/index.html'
  for file in index.html index.js index.wasm index.pck; do
    if [ ! -s "$project_dir/build/web/$file" ]; then
      log "the export finished but build/web/$file is missing or empty"
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
