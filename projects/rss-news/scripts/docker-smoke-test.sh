#!/usr/bin/env bash
# Builds the Docker image, starts a container with dummy settings and a throwaway data folder
# mounted where the database lives, checks /healthz, that the PWA loads under the prefix and that
# the container uses under the memory limit, then removes it.
# Usage: scripts/docker-smoke-test.sh   (run from projects/rss-news)
set -euo pipefail

image=rss-news:smoke-test
container=rss-news-smoke-test-$$
port=${SMOKE_TEST_PORT:-18001}
base="http://127.0.0.1:$port/ai-projects/rss-news"
data_mount=/app/data
# The spec's budget for the whole container on the Beelink.
memory_limit_mb=300

docker build --tag "$image" .
data_dir=$(mktemp -d)
trap 'docker rm --force "$container" >/dev/null; rm -r "$data_dir"' EXIT
# Run as the calling user, as the deploy will, so a data folder it can't write fails here.
docker run --detach --name "$container" --publish "127.0.0.1:$port:8000" \
  --user "$(id -u):$(id -g)" \
  --volume "$data_dir:$data_mount" \
  --env RSS_NEWS_LOG_LEVEL=DEBUG \
  --env RSS_NEWS_TIMEZONE=Asia/Kuala_Lumpur \
  "$image" >/dev/null

fail() {
  echo "FAIL: $1. Container logs:" >&2
  docker logs "$container" >&2
  exit 1
}

for _ in $(seq 30); do
  if curl --silent --fail "$base/healthz"; then
    echo
    echo "OK: $base/healthz answered"
    break
  fi
  sleep 1
done
curl --silent --fail --output /dev/null "$base/healthz" || fail "$base/healthz did not answer within 30 seconds"

# The page and the script it loads prove the Node stage's build made it into the image.
page=$(curl --silent --fail "$base/") || fail "$base/ did not answer"
script=$(grep --only-matching --max-count=1 'assets/[^"]*\.js' <<<"$page") || fail "$base/ has no script tag"
curl --silent --fail --output /dev/null "$base/$script" || fail "$base/$script did not load"
echo "OK: the PWA and $script load under the prefix"

[ -f "$data_dir/rss-news.sqlite3" ] || fail "the database isn't in the data folder mounted at $data_mount"
echo "OK: the database is in the data folder"

# The container's own cgroup (v2) counts every process in it, in bytes.
memory_bytes=$(docker exec "$container" cat /sys/fs/cgroup/memory.current) \
  || fail "can't read the container's memory use (needs cgroup v2)"
memory_mb=$((memory_bytes / 1024 / 1024))
[ "$memory_mb" -lt "$memory_limit_mb" ] || fail "the container uses ${memory_mb}MB, over ${memory_limit_mb}MB"
echo "OK: the container uses ${memory_mb}MB (limit ${memory_limit_mb}MB)"
