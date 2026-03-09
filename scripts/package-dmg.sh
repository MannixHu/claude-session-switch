#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "DMG packaging is only supported on macOS."
  exit 1
fi

APP_PATH="${1:-src-tauri/target/release/bundle/macos/Claude Session Switch.app}"
if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found: ${APP_PATH}"
  exit 1
fi

VERSION="${VERSION:-$(node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));process.stdout.write(pkg.version);")}"
ARCH_INPUT="${ARCH:-$(uname -m)}"

case "${ARCH_INPUT}" in
  arm64|aarch64)
    ARCH_SUFFIX="arm64"
    ;;
  x86_64|amd64)
    ARCH_SUFFIX="x64"
    ;;
  *)
    ARCH_SUFFIX="${ARCH_INPUT}"
    ;;
esac

OUT_DIR="${OUT_DIR:-src-tauri/target/release/bundle/dmg}"
mkdir -p "${OUT_DIR}"

DMG_PATH="${OUT_DIR}/ClaudeSessionSwitch_${VERSION}_${ARCH_SUFFIX}.dmg"
APP_NAME="$(basename "${APP_PATH}" .app)"
STAGING_DIR="$(mktemp -d)"

cleanup() {
  hdiutil detach "/Volumes/${APP_NAME}" -force >/dev/null 2>&1 || true
  rm -rf "${STAGING_DIR}"
}
trap cleanup EXIT

cp -R "${APP_PATH}" "${STAGING_DIR}/"
ln -s /Applications "${STAGING_DIR}/Applications"

rm -f "${DMG_PATH}"
for attempt in 1 2 3; do
  echo "Creating DMG (attempt ${attempt}): ${DMG_PATH}"
  hdiutil detach "/Volumes/${APP_NAME}" -force >/dev/null 2>&1 || true

  if hdiutil create -volname "${APP_NAME}" -srcfolder "${STAGING_DIR}" -ov -format UDZO "${DMG_PATH}"; then
    echo "DMG created: ${DMG_PATH}"
    exit 0
  fi

  rm -f "${DMG_PATH}"
  sleep 2
done

echo "Failed to create DMG after 3 attempts: ${DMG_PATH}"
exit 1
