#!/usr/bin/env bash
# Installs the pinned Android command-line tools and the SDK packages Gloss builds with,
# so a fresh machine can build without Android Studio. Safe to run again: it skips what is there.
#
# Settings (environment variables):
#   ANDROID_HOME  where the SDK goes (default: ~/Android/Sdk, Android Studio's default)
#
# The platform and build-tools versions are read from gradle/libs.versions.toml, so the build
# and this script can't drift apart. The command-line tools are pinned here by version and
# checksum, from https://dl.google.com/android/repository/repository2-3.xml.
set -euo pipefail

readonly cmdline_tools_version="23.0"
readonly cmdline_tools_zip="commandlinetools-linux-16111833_latest.zip"
readonly cmdline_tools_sha1="e025545c62a8e64c7559119566a569fb1dec5f60"
# Package revisions, from `android sdk list --all`.
readonly platform_revision="2.0.0"
readonly platform_tools_version="37.0.1"

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly project_dir
readonly catalog="$project_dir/gradle/libs.versions.toml"
sdk_dir="${ANDROID_HOME:-$HOME/Android/Sdk}"
readonly sdk_dir

log() { printf 'setup-android-sdk: %s\n' "$*"; }
fail() { printf 'setup-android-sdk: error: %s\n' "$*" >&2; exit 1; }

# Prints the value of a `name = "value"` line in the version catalog's [versions] table.
catalog_version() {
  local value
  value="$(sed -n -E "s/^$1[[:space:]]*=[[:space:]]*\"([^\"]+)\".*/\1/p" "$catalog")"
  [[ -n $value ]] || fail "no '$1' version in $catalog"
  echo "$value"
}

install_cmdline_tools() {
  local target="$sdk_dir/cmdline-tools/$cmdline_tools_version"
  if [[ -x $target/bin/android ]]; then
    log "command-line tools $cmdline_tools_version already in $target"
    return
  fi
  command -v java >/dev/null || fail "java not found; install a JDK or JRE 17+ (e.g. apt install openjdk-21-jre-headless)"
  command -v unzip >/dev/null || fail "unzip not found (apt install unzip)"

  # Global, not local: the EXIT trap runs after this function's variables are gone.
  download="$(mktemp -d)"
  trap 'rm -r -- "$download"' EXIT
  log "downloading command-line tools $cmdline_tools_version"
  curl -fsSL -o "$download/tools.zip" "https://dl.google.com/android/repository/$cmdline_tools_zip"
  echo "$cmdline_tools_sha1  $download/tools.zip" | sha1sum -c --quiet - ||
    fail "checksum mismatch for $cmdline_tools_zip"
  unzip -q "$download/tools.zip" -d "$download"
  mkdir -p "$(dirname "$target")"
  mv "$download/cmdline-tools" "$target"
  log "command-line tools installed in $target"
}

# Since command-line tools 23.0, the `android` CLI replaces sdkmanager (which now only forwards
# to it and needs no license step). On first use it unpacks itself into ~/.android/cli.
install_packages() {
  local compile_sdk build_tools
  compile_sdk="$(catalog_version compileSdk)"
  build_tools="$(catalog_version buildTools)"
  local -a packages=(
    "platforms/android-$compile_sdk@$platform_revision"
    "build-tools/$build_tools@$build_tools"
    "platform-tools@$platform_tools_version"
  )
  local android_cli="$sdk_dir/cmdline-tools/$cmdline_tools_version/bin/android"

  log "installing ${packages[*]}"
  "$android_cli" --no-metrics --sdk="$sdk_dir" sdk install "${packages[@]}"
}

# Gradle finds the SDK through local.properties (git-ignored) or ANDROID_HOME.
write_local_properties() {
  echo "sdk.dir=$sdk_dir" >"$project_dir/local.properties"
  log "wrote $project_dir/local.properties"
}

main() {
  log "SDK location: $sdk_dir"
  install_cmdline_tools
  install_packages
  write_local_properties
  log "done; build with ./gradlew assembleDebug"
}

main "$@"
