#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?target is required}"
TARGET_ROOT="${TARGET_ROOT:-src-tauri/target}"

if [[ -d "${TARGET_ROOT}/${TARGET}/release/bundle" ]]; then
  BUNDLE_DIR="${TARGET_ROOT}/${TARGET}/release/bundle"
elif [[ -d "${TARGET_ROOT}/release/bundle" ]]; then
  BUNDLE_DIR="${TARGET_ROOT}/release/bundle"
else
  echo "::error::Bundle directory not found under ${TARGET_ROOT}" >&2
  find "${TARGET_ROOT}" -maxdepth 5 -type d -name bundle >&2 || true
  exit 1
fi

APP_PATH="$(find "${BUNDLE_DIR}" -maxdepth 4 -type d -name "*.app" | head -n 1)"
if [[ -z "${APP_PATH}" ]]; then
  echo "::error::No .app bundle found under ${BUNDLE_DIR}" >&2
  find "${BUNDLE_DIR}" -maxdepth 4 -print >&2
  exit 1
fi

printf 'BUNDLE_DIR=%q\n' "${BUNDLE_DIR}"
printf 'APP_PATH=%q\n' "${APP_PATH}"
