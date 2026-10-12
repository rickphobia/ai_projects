# Settings and the container swap shared by update-site.sh and rollback.sh. Sourced, not run.
# Every setting is an environment variable with a default; see "Deploy" in the project README.
# shellcheck shell=bash disable=SC2034  # variables are used by the scripts that source this

REPO_URL="${RSS_NEWS_REPO_URL:-https://github.com/rickphobia/ai_slops.git}"
BRANCH="${RSS_NEWS_BRANCH:-main}"
SRC_DIR="${RSS_NEWS_SRC_DIR:-$HOME/homelab/dev/ai_slops}"
ENV_FILE="${RSS_NEWS_ENV_FILE:-$HOME/homelab/env/rss-news.env}"
DATA_DIR="${RSS_NEWS_DATA_DIR:-$HOME/homelab/data/rss-news}"
NETWORK="${RSS_NEWS_NETWORK:-homelab_default}"
FORCE="${RSS_NEWS_FORCE:-0}"

IMAGE_REPO="rss-news"
# The name nginx proxies to. Only the live container carries it on the shared network.
NETWORK_ALIAS="rss-news"
STATE_DIR="$(dirname "$SRC_DIR")"
DEPLOYED_TAG_FILE="$STATE_DIR/rss-news.deployed-tag"
PREVIOUS_TAG_FILE="$STATE_DIR/rss-news.previous-tag"
LOCK_FILE="$STATE_DIR/rss-news.lock"
HEALTH_TIMEOUT_SECONDS=60
# Where DATA_DIR is mounted in the container: the folder the image keeps its SQLite file in
# (RSS_NEWS_DATABASE_PATH in the Dockerfile).
DATA_MOUNT=/app/data

log() { printf '%s %s: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SCRIPT_NAME" "$*" >&2; }

take_lock() {
  mkdir -p "$STATE_DIR"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "another deploy or rollback is already running; exiting"
    exit 0
  fi
}

check_host_setup() {
  if [ ! -f "$ENV_FILE" ]; then
    log "env file $ENV_FILE is missing; see \"One-time setup\" in the README"
    return 1
  fi
  if [ ! -d "$DATA_DIR" ]; then
    log "data folder $DATA_DIR is missing; see \"One-time setup\" in the README"
    return 1
  fi
}

# Running rss-news containers other than the one named in $1.
other_containers() {
  docker ps --all --filter "name=^rss-news-[0-9a-f]+-[0-9]+$" --format '{{.Names}}' | grep -vx "$1" || true
}

# Start a container from the given tag, wait for /healthz, then give it the network alias and
# remove the old one. If it never gets healthy, remove it and leave the old one running.
swap_to() {
  local tag="$1"
  local name
  name="rss-news-$tag-$(date +%s)"

  # Started on the default bridge (internet access, no alias), so nginx keeps reaching the old
  # container until the new one is healthy. The host user owns the data folder, so run as it.
  # The env file starts as a copy of .env.example, whose local-run paths would override the
  # image's, so the container paths are forced here.
  docker run --detach --name "$name" \
    --restart unless-stopped \
    --user "$(id -u):$(id -g)" --env HOME=/tmp \
    --env-file "$ENV_FILE" --env RSS_NEWS_HOST=0.0.0.0 \
    --env RSS_NEWS_DATABASE_PATH="$DATA_MOUNT/rss-news.sqlite3" --env RSS_NEWS_PWA_DIR=/app/pwa \
    --volume "$DATA_DIR:$DATA_MOUNT" \
    "$IMAGE_REPO:$tag" >/dev/null

  log "waiting up to ${HEALTH_TIMEOUT_SECONDS}s for /healthz in $name"
  local waited=0
  until docker exec "$name" python -c \
    "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ['RSS_NEWS_PORT']}/healthz\", timeout=4)" \
    >/dev/null 2>&1; do
    if [ "$waited" -ge "$HEALTH_TIMEOUT_SECONDS" ]; then
      log "$name failed /healthz; its last logs follow. The old container keeps running."
      docker logs --tail 50 "$name" >&2 || true
      docker rm --force "$name" >/dev/null
      return 1
    fi
    sleep 2
    waited=$((waited + 2))
  done

  local old
  for old in $(other_containers "$name"); do
    docker network disconnect "$NETWORK" "$old" >/dev/null 2>&1 || true
  done
  docker network connect --alias "$NETWORK_ALIAS" "$NETWORK" "$name"
  for old in $(other_containers "$name"); do
    docker rm --force "$old" >/dev/null
  done
  log "$name is live on $NETWORK as $NETWORK_ALIAS"
}
