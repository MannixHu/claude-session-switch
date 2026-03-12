#!/usr/bin/env bash
set -euo pipefail

CURRENT_TAG="${1:-}"

if [[ -z "${CURRENT_TAG}" ]]; then
  echo "usage: $0 <current-tag>" >&2
  exit 1
fi

if ! git rev-parse --verify "${CURRENT_TAG}^{tag}" >/dev/null 2>&1 \
  && ! git rev-parse --verify "${CURRENT_TAG}^{commit}" >/dev/null 2>&1; then
  echo "tag or commit not found: ${CURRENT_TAG}" >&2
  exit 1
fi

PREVIOUS_TAG="$(git describe --tags --abbrev=0 "${CURRENT_TAG}^" 2>/dev/null || true)"

escape_markdown() {
  local value="${1}"
  value="${value//\\/\\\\}"
  value="${value//|/\\|}"
  printf '%s' "${value}"
}

echo "## Changelog"
echo
echo "| Commit | Description |"
echo "| --- | --- |"

if [[ -n "${PREVIOUS_TAG}" ]]; then
  RANGE="${PREVIOUS_TAG}..${CURRENT_TAG}"
else
  RANGE="${CURRENT_TAG}"
fi

while IFS=$'\t' read -r short_sha subject || [[ -n "${short_sha}" ]]; do
  [[ -n "${short_sha}" ]] || continue
  printf '| `%s` | %s |\n' "${short_sha}" "$(escape_markdown "${subject}")"
done < <(git log --no-merges --pretty=format:'%h%x09%s' "${RANGE}")
