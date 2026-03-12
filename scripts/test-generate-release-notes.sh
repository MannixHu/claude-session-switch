#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

cd "${TMP_DIR}"
git init -q
git config user.name "Codex"
git config user.email "codex@example.com"
git remote add origin https://github.com/example/release-notes-test.git

echo "one" > notes.txt
git add notes.txt
git commit -q -m "chore: initial release"
git tag v0.1.0

echo "two" >> notes.txt
git add notes.txt
git commit -q -m "feat: add release notes generator"

echo "release" >> notes.txt
git add notes.txt
git commit -q -m "release: v0.1.1"

echo "three" >> notes.txt
git add notes.txt
git commit -q -m "fix: escape markdown pipes | in subjects"
git tag v0.1.1

OUTPUT="$(bash "${REPO_ROOT}/scripts/generate-release-notes.sh" v0.1.1)"

[[ "${OUTPUT}" == *"## Changelog"* ]] || {
  echo "missing changelog heading"
  exit 1
}

[[ "${OUTPUT}" == *"| Commit | Description |"* ]] || {
  echo "missing markdown table header"
  exit 1
}

LATEST_SHA="$(git rev-parse --short HEAD)"
LATEST_FULL_SHA="$(git rev-parse HEAD)"
FEATURE_SHA="$(git rev-parse --short HEAD~2)"
FEATURE_FULL_SHA="$(git rev-parse HEAD~2)"

[[ "${OUTPUT}" == *"| [\`${LATEST_SHA}\`](https://github.com/example/release-notes-test/commit/${LATEST_FULL_SHA}) | fix: escape markdown pipes \| in subjects |"* ]] || {
  echo "missing linked latest commit row"
  exit 1
}

[[ "${OUTPUT}" == *"| [\`${FEATURE_SHA}\`](https://github.com/example/release-notes-test/commit/${FEATURE_FULL_SHA}) | feat: add release notes generator |"* ]] || {
  echo "missing linked feature commit row"
  exit 1
}

[[ "${OUTPUT}" != *"release: v0.1.1"* ]] || {
  echo "release commits should be omitted"
  exit 1
}

echo "ok"
