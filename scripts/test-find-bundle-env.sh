#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

TARGET="aarch64-apple-darwin"
APP_PATH_EXPECTED="${TMP_DIR}/src-tauri/target/${TARGET}/release/bundle/macos/Claude Session Switch.app"
BUNDLE_DIR_EXPECTED="${TMP_DIR}/src-tauri/target/${TARGET}/release/bundle"

mkdir -p "${APP_PATH_EXPECTED}"

OUTPUT="$(TARGET_ROOT="${TMP_DIR}/src-tauri/target" "${REPO_ROOT}/scripts/find-bundle-env.sh" "${TARGET}")"
eval "${OUTPUT}"

if [[ "${APP_PATH}" != "${APP_PATH_EXPECTED}" ]]; then
  echo "APP_PATH mismatch"
  echo "expected: ${APP_PATH_EXPECTED}"
  echo "actual:   ${APP_PATH}"
  exit 1
fi

if [[ "${BUNDLE_DIR}" != "${BUNDLE_DIR_EXPECTED}" ]]; then
  echo "BUNDLE_DIR mismatch"
  echo "expected: ${BUNDLE_DIR_EXPECTED}"
  echo "actual:   ${BUNDLE_DIR}"
  exit 1
fi

echo "ok"
