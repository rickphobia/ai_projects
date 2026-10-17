#!/usr/bin/env bash
# Build the game and zip it for an itch.io HTML upload: index.html at the zip's root and
# relative asset paths, so it runs from itch's own folder. Writes itch/against-all-tod-<version>.zip.
# Usage: npm run itch-zip   (VITE_BUILD_VERSION=<name> overrides the version, which defaults to the commit)
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

log() { printf 'itch-zip: %s\n' "$*" >&2; }

if ! command -v zip >/dev/null; then
  log "zip not found; install it (on Ubuntu: sudo apt install zip)"
  exit 1
fi
[ -f .env ] || cp .env.example .env

version="${VITE_BUILD_VERSION:-$(git rev-parse --short HEAD)}"
zip_path="$project_dir/itch/against-all-tod-$version.zip"

log "building $version"
# Shell variables beat .env, so the zip always gets relative paths whatever .env says.
VITE_BASE_PATH=./ VITE_BUILD_VERSION="$version" npm run build >&2

mkdir -p "$(dirname "$zip_path")"
rm -f "$zip_path"
(cd dist && zip -qr "$zip_path" .)
log "wrote $zip_path ($(du -h "$zip_path" | cut -f1)); upload it to itch.io as an HTML game"
