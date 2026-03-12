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

resolve_repo_web_url() {
  if [[ -n "${GITHUB_SERVER_URL:-}" && -n "${GITHUB_REPOSITORY:-}" ]]; then
    printf '%s/%s' "${GITHUB_SERVER_URL}" "${GITHUB_REPOSITORY}"
    return 0
  fi

  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"

  if [[ -z "${remote_url}" ]]; then
    return 1
  fi

  remote_url="${remote_url%.git}"

  case "${remote_url}" in
    git@*:* )
      remote_url="${remote_url#git@}"
      printf 'https://%s' "${remote_url/:/\/}"
      ;;
    ssh://git@* )
      remote_url="${remote_url#ssh://git@}"
      printf 'https://%s' "${remote_url}"
      ;;
    https://*|http://* )
      printf '%s' "${remote_url}"
      ;;
    * )
      return 1
      ;;
  esac
}

REPO_WEB_URL="$(resolve_repo_web_url || true)"

echo "## Changelog"
echo
echo "| Commit | Description |"
echo "| --- | --- |"

if [[ -n "${PREVIOUS_TAG}" ]]; then
  RANGE="${PREVIOUS_TAG}..${CURRENT_TAG}"
else
  RANGE="${CURRENT_TAG}"
fi

while IFS=$'\t' read -r full_sha short_sha subject || [[ -n "${full_sha}" ]]; do
  [[ -n "${full_sha}" ]] || continue
  [[ "${subject}" =~ ^release:\ v[0-9] ]] && continue

  if [[ -n "${REPO_WEB_URL}" ]]; then
    commit_cell="[\`${short_sha}\`](${REPO_WEB_URL}/commit/${full_sha})"
  else
    commit_cell="\`${short_sha}\`"
  fi

  printf '| %s | %s |\n' "${commit_cell}" "$(escape_markdown "${subject}")"
done < <(git log --no-merges --pretty=format:'%H%x09%h%x09%s' "${RANGE}")
