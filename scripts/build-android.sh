#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-0.1.0}"

npm run check
if [[ ! -d android ]]; then
  npx cap add android
fi
npx cap sync android

GRADLE_FILE="android/app/build.gradle"
sed -i -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE}/" "$GRADLE_FILE"
sed -i -E "s/versionName \"[^\"]+\"/versionName \"${VERSION_NAME}\"/" "$GRADLE_FILE"

(cd android && ./gradlew clean assembleDebug)

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$SDK_ROOT" ]]; then
  echo "ANDROID_SDK_ROOT/ANDROID_HOME is not set" >&2
  exit 2
fi
BUILD_TOOLS="$(find "$SDK_ROOT/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
APKSIGNER="$BUILD_TOOLS/apksigner"
ZIPALIGN="$BUILD_TOOLS/zipalign"
DEBUG_APK="android/app/build/outputs/apk/debug/app-debug.apk"

"$ZIPALIGN" -c -P 16 -v 4 "$DEBUG_APK"
"$APKSIGNER" verify --verbose --print-certs "$DEBUG_APK"
unzip -t "$DEBUG_APK" >/dev/null
sha256sum "$DEBUG_APK" | tee "$DEBUG_APK.sha256"

echo "Verified debug APK: $DEBUG_APK"
